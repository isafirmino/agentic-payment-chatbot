"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ChatSession {
  token: string;
  cpf: string;
  nome: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const authUrl =
        process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:3001";
      const res = await fetch(`${authUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, senha }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao fazer login");
        return;
      }

      // Sucesso: salva session no localStorage e redireciona
      const session: ChatSession = {
        token: data.token,
        cpf: data.cpf,
        nome: data.nome,
      };
      localStorage.setItem("chat_session", JSON.stringify(session));
      router.push("/");
    } catch (err) {
      setErro("Erro ao conectar com o servidor");
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px" }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="cpf">CPF:</label>
          <input
            id="cpf"
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            required
            disabled={carregando}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="senha">Senha:</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            disabled={carregando}
            style={{ width: "100%", padding: "8px", marginTop: "5px" }}
          />
        </div>

        {erro && (
          <div style={{ color: "red", marginBottom: "15px" }}>{erro}</div>
        )}

        <button
          type="submit"
          disabled={carregando}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: carregando ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: carregando ? "not-allowed" : "pointer",
          }}
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p style={{ marginTop: "20px", textAlign: "center" }}>
        Não tem conta?{" "}
        <Link
          href="/cadastro"
          style={{ color: "#007bff", textDecoration: "none" }}
        >
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
