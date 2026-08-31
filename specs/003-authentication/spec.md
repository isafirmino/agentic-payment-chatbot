# 003 — Cadastro, login e autenticação com JWT

## Problema

O chat (`chat-web`) não tem nenhuma barreira de acesso — qualquer pessoa consegue conversar. O desafio exige que apenas usuários autenticados usem o chat, e cada usuário tenha seu próprio limite de gasto no backend.

## Solução

Sistema de autenticação JWT com:

- Cadastro de novo usuário (nome, CPF, senha)
- Login com CPF e senha
- Token JWT que identifica o usuário (`sub=cpf`, 1h expiração)
- Gate client-side: chat redireciona para login se sem sessão válida
- Limite de gasto (R$ 1.000,00 por padrão) armazenado no backend, consultável para validação de compras

## User stories

1. Como novo usuário, eu quero me cadastrar com nome, CPF e senha, para que eu tenha uma conta e possa fazer login depois.
2. Como usuário, eu quero fazer login com CPF e senha, para que eu acesse o chat e converso com o agente.
3. Como usuário autenticado, eu quero que meu limite de gasto (R$ 1.000,00) seja respeitado nas compras, para que eu não gaste mais do que posso.
4. Como usuário deslogado, eu quero ser redirecionado para o login ao tentar acessar o chat, para que minhas compras fiquem seguras.
5. Como agente MCP, eu quero consultar o limite de gasto de um usuário, para que eu possa validar se uma compra é permitida.

**Casos de erro:**

- Cadastro com CPF duplicado → erro explícito no frontend
- Login com CPF/senha errada → erro explícito no frontend
- Token expirado → redireciona pra login com mensagem

## Decisões de implementação

**Backend (`api-auth/`):**

- Tabela `usuarios(cpf TEXT PRIMARY KEY, nome TEXT NOT NULL, password_hash TEXT NOT NULL, limite_cents INTEGER NOT NULL DEFAULT 100000)` no SQLite (compartilhado via Task 0)
- `POST /auth/cadastro` (nome, cpf, senha) → grava usuário, rejeita CPF duplicado
- `POST /auth/login` (cpf, senha) → valida, emite JWT com `{ sub: cpf, expiresIn: '1h' }`
- `GET /usuarios/me/limite` (requer JWT) → retorna `{ limite_cents }`
- Senhas hasheadas com scrypt (reusar `hashPassword`/`verifyPassword` existentes)
- Porta padrão alterada para 3001 (evitar colisão com Next.js)
- `JWT_SECRET` documentado no `.env.example` como compartilhado com `mcp-server`

**Frontend (`chat-web/`):**

- `src/app/cadastro/page.tsx` (novo): form nome/CPF/senha → `POST /auth/cadastro` → redireciona pra login
- `src/app/login/page.tsx` (novo): form CPF/senha → `POST /auth/login` → grava `{ token, cpf, nome }` em `localStorage` → redireciona pra `/`
- `src/app/page.tsx` (modificado): gate client-side — se sem `localStorage['chat_session']`, redireciona pra `/login`
- `src/app/api/chat/route.ts` (modificado): lê `Authorization` header e repassa pro MCP server
- Env var `NEXT_PUBLIC_AUTH_URL` (ex.: `http://localhost:3001`)

**Contrato MCP:**

- `mcp-server` recebe JWT no header `Authorization: Bearer <token>`, extrai CPF do `sub`
- Antes de `realizar_compra`, valida limite consultando `GET /usuarios/me/limite` em `api-auth`

## Decisões de teste

- Testes unitários em `api-auth/src/app.test.ts`: cadastro (novo/duplicado), login (sucesso/erro), JWT format, endpoint `/usuarios/me/limite`
- Mínimo 80% cobertura de funções (`--test-coverage-functions=80`)
- Verificação manual: cadastro → login → redireciona pra chat; sessão expirada → redireciona pra login

## Fora de escopo

- Validação de formato de CPF (dígito verificador) — aceita qualquer string não-vazia
- Requisitos de força de senha — aceita qualquer string não-vazia
- Logout explícito — recarregar página inteira (tech debt)
- Recuperação de senha — não pedido
- Autenticação social (Google, GitHub, etc.) — não pedido
- Refresh de token — JWT fixo 1h (não pedido)
