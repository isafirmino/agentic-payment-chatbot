# Guia de Uso — Autenticação (Cadastro e Login)

> Como se cadastrar e fazer login no Agentic Payments Chatbot.

---

## 1. Pré-requisitos

Antes de tudo, garanta que os dois serviços estão rodando:

| Serviço | Porta | Comando |
|---------|-------|---------|
| **api-auth** (backend de autenticação) | `3001` | `cd api-auth && npm start` |
| **chat-web** (frontend Next.js) | `3000` | `cd chat-web && npm run dev` |

> O `mcp-server` (porta `4000`) também precisa estar de pé para o chat funcionar depois do login.

Abra o navegador em **http://localhost:3000**.

---

## 2. Como se cadastrar

1. Acesse **http://localhost:3000**.
2. Você será redirecionado automaticamente para a tela de **Login**.
3. Clique no link **"Cadastre-se"** (embaixo do botão de login).
4. Você cairá na tela de **Cadastro** (`/cadastro`).
5. Preencha os três campos:
   - **Nome** — seu nome completo.
   - **CPF** — apenas números (ex.: `12345678901`).
   - **Senha** — a senha que você vai usar pra entrar.
6. Clique em **"Cadastrar"**.
7. Se tudo der certo, você será redirecionado de volta pra tela de **Login**.

> 💡 **Dica:** o campo de senha tem um olhinho 👁 ao lado. Clique nele pra mostrar/ocultar a senha enquanto digita.

### Possíveis erros no cadastro

| Mensagem | Causa | Solução |
|----------|-------|---------|
| `CPF já cadastrado` | Esse CPF já tem conta | Vá direto pra tela de login |
| `Erro ao conectar com o servidor` | api-auth não está rodando | Suba o backend (`npm start` em `api-auth/`) |

---

## 3. Como fazer login

1. Acesse **http://localhost:3000/login** (ou **http://localhost:3000**, que redireciona).
2. Preencha:
   - **CPF** — o mesmo CPF que você cadastrou.
   - **Senha** — a senha definida no cadastro.
3. Clique em **"Entrar"**.
4. Se as credenciais estiverem certas, você será redirecionado pro **chat** (`/`).

> 💡 **Dica:** o campo de senha tem um olhinho 👁 ao lado. Clique nele pra mostrar/ocultar a senha enquanto digita.

### Possíveis erros no login

| Mensagem | Causa | Solução |
|----------|-------|---------|
| `CPF ou senha inválidos` | CPF não existe ou senha errada | Confira os dados ou faça cadastro |
| `Erro ao conectar com o servidor` | api-auth não está rodando | Suba o backend |

---

## 4. O que acontece depois do login

- O navegador grava um **token JWT** no `localStorage` (chave `chat_session`).
- Esse token vale por **1 hora**. Depois disso, você é deslogado automaticamente e precisa logar de novo.
- Toda mensagem que você envia no chat leva esse token no header `Authorization: Bearer <token>`.
- O backend (`api-auth`) e o `mcp-server` usam o mesmo `JWT_SECRET` pra validar o token — por isso o limite de gasto (R$ 1.000,00 padrão) é respeitado nas compras.

---

## 5. Como sair (logout)

Hoje não tem botão de "Sair" na interface. Pra deslogar manualmente:

1. Abra o **DevTools** do navegador (`F12`).
2. Vá na aba **Application** → **Local Storage** → `http://localhost:3000`.
3. Apague a chave `chat_session`.
4. Recarregue a página — você volta pra tela de login.

---

## 6. Resumo visual do fluxo

```
┌──────────────┐
│  /  (chat)   │ ─── sem token ──▶  redireciona pra /login
└──────────────┘
        ▲
        │ login OK (token gravado no localStorage)
        │
┌──────────────┐
│   /login     │ ─── "Cadastre-se" ──▶  /cadastro
└──────────────┘                         │
        ▲                                │ cadastro OK
        └────────── redireciona ─────────┘
```

---

## 7. Onde os dados ficam guardados

| Dado | Onde |
|------|------|
| Nome, CPF, hash da senha, limite de gasto | SQLite em `data/app.db` (compartilhado entre `api-auth` e `mcp-server`) |
| Token JWT da sessão | `localStorage` do navegador (chave `chat_session`) |
| Senha em texto puro | **Nunca** — só o hash (scrypt) vai pro banco |

---

## 8. Problemas comuns

### "Não consigo cadastrar, dá erro de conexão"
- O `api-auth` está rodando? Rode `cd api-auth && npm start` num terminal separado.
- A porta `3001` está livre? Se outra coisa estiver usando, mude o `PORT` no `api-auth/.env`.

### "Login retorna 'CPF ou senha inválidos' mas eu acabei de me cadastrar"
- CPF foi digitado igual ao do cadastro? (sem pontos, sem traços)
- Senha está correta? (atenção a maiúsculas/minúsculas)

### "Entrei mas o chat não responde"
- O `mcp-server` está rodando? (`cd mcp-server && npm start`, porta `4000`)
- O `JWT_SECRET` no `api-auth/.env` é o mesmo do `mcp-server/.env`?

---

> Dúvidas? Veja o ADR `docs/adr/0003-authentication-jwt-cpf.md` ou a spec `specs/003-authentication/spec.md`.
