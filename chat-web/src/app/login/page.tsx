'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AUTH_MESSAGE_KEY, type ChatSession } from '@/lib/auth/session'

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
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="cpf">CPF:</label>
          <input
            id="cpf"
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            required
            disabled={carregando}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="senha">Senha:</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
            <input
              id="senha"
              type={mostrarSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              disabled={carregando}
              style={{ flex: 1, padding: '8px' }}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((value) => !value)}
              disabled={carregando}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {mostrarSenha ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        {erro && (
          <div style={{ color: 'red', marginBottom: '15px' }}>{erro}</div>
        )}

        <button
          type="submit"
          disabled={carregando}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: carregando ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: carregando ? 'not-allowed' : 'pointer',
          }}
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p style={{ marginTop: '20px', textAlign: 'center' }}>
        Não tem conta?{' '}
        <Link
          href="/cadastro"
          style={{ color: '#007bff', textDecoration: 'none' }}
        >
          Cadastre-se
        </Link>
      </p>
    </div>
  )
}
