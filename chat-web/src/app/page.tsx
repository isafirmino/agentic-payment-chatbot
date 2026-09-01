'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Markdown from 'react-markdown'
import { buildPayload, toHistory, type Turn } from '@/lib/chat/payload'
import { AUTH_MESSAGE_KEY, parseChatSession } from '@/lib/auth/session'
import TypingDots from '@/components/chat/TypingDots'

export default function Page() {
  const router = useRouter()
  const [autenticado, setAutenticado] = useState(false)
  const [nome, setNome] = useState('')
  const [messages, setMessages] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [peek, setPeek] = useState<number | null>(null)
  const [pinned, setPinned] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  // Identidade desta conversa, gerada uma vez e mantida só em memória: um
  // reload começa outra conversa, e a intenção registrada na anterior deixa de
  // ser pagável. É o que torna a regra verdadeira — sem histórico não há
  // conversa. Ver ADR 0007.
  const conversaId = useRef<string>(crypto.randomUUID())

  // Gate: checa autenticação no mount
  useEffect(() => {
    const session = parseChatSession(localStorage.getItem('chat_session'))
    if (!session) {
      localStorage.removeItem('chat_session')
      router.replace('/login')
    } else {
      setAutenticado(true)
      setNome(session.nome)
    }
  }, [router])

  // Auto-scroll para o fim quando novas mensagens chegam
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  function logout() {
    localStorage.removeItem('chat_session')
    router.replace('/login')
  }

  // Se não autenticado, não renderiza o chat
  if (!autenticado) {
    return <div>Redirecionando...</div>
  }

  function showPeek(i: number) {
    clearTimeout(closeTimer.current)
    if (!pinned) setPeek(i)
  }
  function hidePeek() {
    if (pinned) return
    closeTimer.current = setTimeout(() => setPeek(null), 400)
  }
  // Fixar existe pra dar pra capturar a tela do painel: no hover puro, o
  // cursor precisa ficar parado em cima enquanto se aciona a captura.
  function togglePin(i: number) {
    clearTimeout(closeTimer.current)
    const desfixar = pinned && peek === i
    setPinned(!desfixar)
    setPeek(desfixar ? null : i)
  }

  function redirectToLogin(message: string) {
    localStorage.removeItem('chat_session')
    sessionStorage.setItem(AUTH_MESSAGE_KEY, message)
    router.replace('/login')
  }

  async function send(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!input.trim() || busy) return

    const payload = buildPayload(toHistory(messages), input)
    const turn: Turn = { role: 'user', content: input, sent: payload }
    const next: Turn[] = [...messages, turn]

    setMessages([...next, { role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)

    try {
      const session = parseChatSession(localStorage.getItem('chat_session'))
      if (!session) {
        redirectToLogin('Faça login para continuar.')
        return
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ messages: payload, conversaId: conversaId.current }),
      })
      if (res.status === 401 || res.status === 403) {
        redirectToLogin('Sua sessão expirou. Faça login novamente.')
        return
      }
      if (!res.ok || !res.body) throw new Error(await res.text())

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      let reply = ''

      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const chunk = JSON.parse(line)
          if (chunk.error) throw new Error(chunk.error)
          if (chunk.tool) {
            turn.tools = [...(turn.tools ?? []), chunk.tool]
            reply = ''
          }
          reply += chunk.message?.content ?? ''
          setMessages([...next, { role: 'assistant', content: reply }])
        }
      }
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: `Erro: ${err}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-uol-blue text-sm font-black text-white">
            U
          </span>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Compass
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{nome}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Sair
        </button>
      </header>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-950"
      >
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Toda a conversa vai junto ao modelo em cada mensagem. Clique numa
            mensagem sua para fixar o painel com o que foi enviado.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={i}
              onMouseEnter={() => showPeek(i)}
              onMouseLeave={hidePeek}
              onClick={() => togglePin(i)}
              title="Ver o que foi enviado ao modelo (clique para fixar)"
              className="ml-auto w-fit max-w-[80%] cursor-pointer whitespace-pre-wrap rounded-2xl rounded-br-sm bg-uol-blue px-4 py-2.5 text-white shadow-sm"
            >
              {m.content}
            </div>
          ) : (
            <div
              key={i}
              className="prose-chat w-fit max-w-[80%] rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-2.5 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {m.content ? (
                <Markdown>{m.content}</Markdown>
              ) : busy && i === messages.length - 1 ? (
                <TypingDots />
              ) : (
                '…'
              )}
            </div>
          ),
        )}
      </div>

      {/* Entrada de texto */}
      <form
        onSubmit={send}
        className="border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-uol-blue focus:ring-2 focus:ring-uol-blue/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte alguma coisa…"
            disabled={busy}
          />
          <button
            className="rounded-xl bg-uol-blue px-5 py-3 font-semibold text-white transition hover:bg-uol-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || !input.trim()}
          >
            Enviar
          </button>
        </div>
      </form>

      {peek !== null && messages[peek]?.sent && (
        <aside
          onMouseEnter={() => showPeek(peek)}
          onMouseLeave={hidePeek}
          className="fixed right-4 top-4 z-10 max-h-[calc(100vh-2rem)] w-80 overflow-y-auto rounded border border-gray-300 bg-white p-3 text-xs shadow-lg xl:w-96 dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              Enviado ao modelo ({messages[peek].sent.length}{' '}
              {messages[peek].sent.length === 1 ? 'mensagem' : 'mensagens'})
            </p>
            {pinned && (
              <button
                onClick={() => togglePin(peek)}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-200"
                aria-label="Desafixar painel"
              >
                fixado ×
              </button>
            )}
          </div>
          {messages[peek].tools?.map((t, j) => (
            <div
              key={`tool-${j}`}
              className="mb-2 rounded border border-amber-400 bg-amber-50 p-2 dark:bg-amber-950"
            >
              <span className="font-mono uppercase text-amber-700 dark:text-amber-400">
                ferramenta · {t.name}
              </span>
              {/* JSON identado e com break-all. Sem indentação não existe
                  espaço em branco onde o whitespace-pre-wrap possa quebrar
                  linha: o objeto vira uma "palavra" única, transborda a
                  largura fixa do painel e o corte cai justamente no fim do
                  retorno — limite_restante numa aprovação, mensagem numa
                  recusa. Este painel é a prova de que a decisão veio do
                  backend, então ele precisa caber inteiro na tela. */}
              <p className="mt-1 whitespace-pre-wrap break-all font-mono">
                <span className="text-amber-700 dark:text-amber-400">
                  argumentos
                </span>
                {'\n'}
                {JSON.stringify(t.arguments, null, 2)}
                {'\n\n'}
                <span className="text-amber-700 dark:text-amber-400">
                  retorno
                </span>
                {'\n'}
                {JSON.stringify(t.result, null, 2)}
              </p>
            </div>
          ))}
          {messages[peek].sent.map((s, j) => (
            <div key={j} className="mb-2 last:mb-0">
              <span className="font-mono uppercase text-gray-500 dark:text-gray-400">
                {s.role}
              </span>
              <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                {s.content}
              </p>
            </div>
          ))}
        </aside>
      )}
    </main>
  )
}
