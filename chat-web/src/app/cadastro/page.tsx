'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AuthCard from '@/components/auth/AuthCard'

export default function CadastroPage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const authUrl =
        process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3001'
      const res = await fetch(`${authUrl}/auth/cadastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cpf, senha }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro no cadastro')
        return
      }

      // Sucesso: redireciona para login
      router.push('/login')
    } catch (err) {
      setErro('Erro ao conectar com o servidor')
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <AuthCard
      title="Crie sua conta"
      subtitle="Cadastre-se para começar a comprar"
      footer={
        <>
          Já tem conta?{' '}
          <Link
            href="/login"
            className="font-semibold text-white underline underline-offset-2 hover:text-uol-yellow transition-colors"
          >
            Faça login
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="nome"
            className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300"
          >
            Nome
          </label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            disabled={carregando}
            placeholder="Seu nome completo"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-uol-blue focus:ring-2 focus:ring-uol-blue/30 outline-none transition disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        <div>
          <label
            htmlFor="cpf"
            className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300"
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
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-uol-blue focus:ring-2 focus:ring-uol-blue/30 outline-none transition disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        <div>
          <label
            htmlFor="senha"
            className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300"
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
              className="w-full px-4 py-3 pr-24 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-uol-blue focus:ring-2 focus:ring-uol-blue/30 outline-none transition disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
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
          {carregando ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>
    </AuthCard>
  )
}
