'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Markdown from 'react-markdown'
import { buildPayload, toHistory, type Turn } from '@/lib/chat/payload'
import { AUTH_MESSAGE_KEY, parseChatSession } from '@/lib/auth/session'

export default function Page() {
  const router = useRouter()
  const [autenticado, setAutenticado] = useState(false)
  const [messages, setMessages] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [peek, setPeek] = useState<number | null>(null)
  const [pinned, setPinned] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  // Gate: checa autenticação no mount
  useEffect(() => {
    const session = parseChatSession(localStorage.getItem('chat_session'))
    if (!session) {
      localStorage.removeItem('chat_session')
      router.replace('/login')
    } else {
      setAutenticado(true)
    }
  }, [router])

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
        body: JSON.stringify({ messages: payload }),
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
    <main className="mx-auto flex h-screen max-w-2xl flex-col gap-4 p-4">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
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
              className="ml-auto w-fit max-w-[80%] cursor-pointer whitespace-pre-wrap rounded bg-blue-600 px-3 py-2 text-white"
            >
              {m.content}
            </div>
          ) : (
            <div
              key={i}
              className="prose-chat w-fit max-w-[80%] rounded bg-gray-200 px-3 py-2 dark:bg-gray-800"
            >
              {m.content ? <Markdown>{m.content}</Markdown> : '…'}
            </div>
          ),
        )}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte alguma coisa…"
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          disabled={busy}
        >
          Enviar
        </button>
      </form>

      {peek !== null && messages[peek]?.sent && (
        <aside
          onMouseEnter={() => showPeek(peek)}
          onMouseLeave={hidePeek}
          className="fixed right-4 top-4 z-10 max-h-[calc(100vh-2rem)] w-80 overflow-y-auto rounded border border-gray-300 bg-white p-3 text-xs shadow-lg xl:w-96 dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="font-semibold">
              Enviado ao modelo ({messages[peek].sent.length}{' '}
              {messages[peek].sent.length === 1 ? 'mensagem' : 'mensagens'})
            </p>
            {pinned && (
              <button
                onClick={() => togglePin(peek)}
                className="rounded border px-2 py-0.5 text-xs"
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
              <p className="whitespace-pre-wrap font-mono">
                {JSON.stringify(t.arguments)} → {JSON.stringify(t.result)}
              </p>
            </div>
          ))}
          {messages[peek].sent.map((s, j) => (
            <div key={j} className="mb-2 last:mb-0">
              <span className="font-mono uppercase text-gray-500">
                {s.role}
              </span>
              <p className="whitespace-pre-wrap">{s.content}</p>
            </div>
          ))}
        </aside>
      )}
    </main>
  )
}
