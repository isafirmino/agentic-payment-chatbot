'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h1>Cadastro</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="nome">Nome:</label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            disabled={carregando}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

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
          {carregando ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>

      <p style={{ marginTop: '20px', textAlign: 'center' }}>
        Já tem conta?{' '}
        <Link
          href="/login"
          style={{ color: '#007bff', textDecoration: 'none' }}
        >
          Faça login
        </Link>
      </p>
    </div>
  )
}
