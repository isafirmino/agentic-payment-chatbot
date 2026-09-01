'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AUTH_MESSAGE_KEY, type ChatSession } from '@/lib/auth/session'
import AuthCard from '@/components/auth/AuthCard'

export default function LoginPage() {
  const router = useRouter()
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    const message = sessionStorage.getItem(AUTH_MESSAGE_KEY)
    if (message) {
      setErro(message)
      sessionStorage.removeItem(AUTH_MESSAGE_KEY)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const authUrl =
        process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3001'
      const res = await fetch(`${authUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, senha }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao fazer login')
        return
      }

      // Sucesso: salva session no localStorage e redireciona
      const session: ChatSession = {
        token: data.token,
        cpf: data.cpf,
        nome: data.nome,
      }
      localStorage.setItem('chat_session', JSON.stringify(session))
      router.push('/')
    } catch (err) {
      setErro('Erro ao conectar com o servidor')
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <AuthCard
      title="Bem-vindo de volta"
      subtitle="Entre para continuar suas compras"
      footer={
        <>
          Não tem conta?{' '}
          <Link
            href="/cadastro"
            className="font-semibold text-white underline underline-offset-2 hover:text-uol-yellow transition-colors"
          >
            Cadastre-se
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="cpf"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            CPF
          </label>
          <input
            id="cpf"
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            required
            disabled={carregando}
            placeholder="000.000.000-00"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-uol-blue focus:ring-2 focus:ring-uol-blue/30 outline-none transition disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="senha"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Senha
          </label>
          <div className="relative">
            <input
              id="senha"
              type={mostrarSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              disabled={carregando}
              placeholder="••••••••"
              className="w-full px-4 py-3 pr-24 rounded-lg border border-gray-300 focus:border-uol-blue focus:ring-2 focus:ring-uol-blue/30 outline-none transition disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((value) => !value)}
              disabled={carregando}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-sm font-medium text-uol-blue hover:bg-uol-blue/10 rounded-md transition"
            >
              {mostrarSenha ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        {erro && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <span aria-hidden="true">⚠</span>
            <span>{erro}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full py-3 rounded-lg font-semibold text-white bg-uol-blue hover:bg-uol-blue-dark focus:ring-4 focus:ring-uol-blue/30 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </AuthCard>
  )
}
