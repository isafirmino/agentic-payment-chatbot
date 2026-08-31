# Tasks — Autenticação (Task #5)

Marque cada item conforme completa. Não avance para o próximo bloco sem finalizar todos da seção.

## Backend (`api-auth/`)

### Preparação

- [ ] Conferir que `db.ts` (Task 0) está disponível em `api-auth/src/` com função `getDb()` exportada
- [ ] Atualizar `.env.example`: adicionar comentário explícito que `JWT_SECRET` é compartilhado com `mcp-server`

### Schema

- [ ] Adicionar tabela `usuarios(cpf TEXT PRIMARY KEY, nome TEXT NOT NULL, password_hash TEXT NOT NULL, limite_cents INTEGER NOT NULL DEFAULT 100000)` no bootstrap de `app.ts` usando `getDb()` e `CREATE TABLE IF NOT EXISTS`
- [ ] Definir `DEFAULT_LIMITE_CENTS = 100000` como env var (padrão R$ 1.000,00)

### `POST /auth/cadastro` (nome, cpf, senha)

- [ ] Validar entrada: `typeof nome === 'string' && cpf && senha && (não vazio)`
- [ ] Hash senha com `hashPassword(senha)` (função já existe)
- [ ] Inserir em DB: `INSERT INTO usuarios(cpf, nome, password_hash, limite_cents) VALUES (...)`
- [ ] Sucesso: retornar `{ message: "cadastro realizado" }`
- [ ] Erro (CPF duplicado): retornar `{ error: "CPF já cadastrado" }` status 400
- [ ] Erro (outro): retornar `{ error: "..." }` status 500

### `POST /auth/login` (cpf, senha)

- [ ] Validar entrada: `typeof cpf === 'string' && typeof senha === 'string'`
- [ ] Buscar usuário em DB: `SELECT * FROM usuarios WHERE cpf = ?`
- [ ] Validar senha com `verifyPassword(senha, stored_hash)`
- [ ] Sucesso: emitir JWT: `jwt.sign({}, JWT_SECRET, { subject: cpf, expiresIn: '1h' })`
- [ ] Sucesso: retornar `{ token, cpf, nome, expiresIn: '1h' }`
- [ ] Erro (not found ou senha errada): retornar `{ error: "CPF ou senha inválidos" }` status 401

### `GET /usuarios/me/limite` (requer JWT válido)

- [ ] Middleware: validar JWT no header `Authorization: Bearer <token>`
- [ ] Extrair `sub` (CPF) do JWT
- [ ] Buscar usuário: `SELECT limite_cents FROM usuarios WHERE cpf = ?`
- [ ] Sucesso: retornar `{ limite_cents }`
- [ ] Erro (token inválido/expirado): retornar `{ error: "..." }` status 401
- [ ] Erro (usuário não encontrado): retornar `{ error: "..." }` status 404

### Limpeza de endpoints (herdados do workshop)

- [ ] Remover `POST /auth/admin/login`
- [ ] Remover `POST /payments`
- [ ] Remover `GET /payments/:id`
- [ ] Remover `GET /payments`
- [ ] Remover tipos `Role` e lógica de `role` no JWT

### Testes (`api-auth/src/app.test.ts`)

- [ ] Teste: cadastro com CPF novo → sucesso `{ message: "..." }`
- [ ] Teste: cadastro com CPF duplicado → erro `{ error: "CPF já cadastrado" }`
- [ ] Teste: login com credenciais corretas → sucesso `{ token, cpf, nome, expiresIn }`
- [ ] Teste: login com CPF errado → erro `{ error: "..." }`
- [ ] Teste: login com senha errada → erro `{ error: "..." }`
- [ ] Teste: JWT contém `sub: cpf` (sem `role`, sem `limite_cents`)
- [ ] Teste: `GET /usuarios/me/limite` com JWT válido → `{ limite_cents: 100000 }`
- [ ] Teste: `GET /usuarios/me/limite` sem JWT → erro 401
- [ ] Teste: `GET /usuarios/me/limite` com JWT inválido → erro 401
- [ ] Cobertura: `npm run check` deve passar com ≥80% de cobertura de funções

### Documentação

- [ ] Criar ADR em `docs/adr/0003-authentication-jwt-cpf.md` registrando:
  - Decisão de usar JWT com `sub=cpf` (sem `role`, sem limite no payload)
  - `DEFAULT_LIMITE_CENTS = 100000` pra todos
  - Compartilhamento de `JWT_SECRET` entre `api-auth` e `mcp-server`

---

## Frontend (`chat-web/`)

### Preparação

- [ ] Adicionar env var `NEXT_PUBLIC_AUTH_URL` em `.env.example` (ex.: `http://localhost:3001`)
- [ ] Confirmar que `NEXT_PUBLIC_AUTH_URL` está definida no `.env` local

### Página de cadastro (`src/app/cadastro/page.tsx`)

- [ ] Criar novo arquivo `'use client'` com form: inputs `nome`, `cpf`, `senha`
- [ ] Input type: `type="password"` pra senha
- [ ] No submit: `POST ${NEXT_PUBLIC_AUTH_URL}/auth/cadastro` com `{ nome, cpf, senha }`
- [ ] Sucesso: redirecionar pra `/login` usando `useRouter().push('/login')`
- [ ] Erro: exibir mensagem do backend abaixo do form
- [ ] Link pra login: "Já tem conta? Faça login"

### Página de login (`src/app/login/page.tsx`)

- [ ] Criar novo arquivo `'use client'` com form: inputs `cpf`, `senha`
- [ ] Input type: `type="password"` pra senha
- [ ] No submit: `POST ${NEXT_PUBLIC_AUTH_URL}/auth/login` com `{ cpf, senha }`
- [ ] Sucesso: grava em `localStorage['chat_session']` objeto `{ token, cpf, nome }`
- [ ] Sucesso: redirecionar pra `/` usando `useRouter().push('/')`
- [ ] Erro: exibir mensagem do backend abaixo do form
- [ ] Link pra cadastro: "Não tem conta? Cadastre-se"

### Gate client-side (`src/app/page.tsx`)

- [ ] Adicionar `useEffect` que roda no mount:
  - Lê `localStorage['chat_session']`
  - Se vazio/null: redireciona pra `/login` antes de renderizar chat
  - Se existe: renderiza chat normalmente
- [ ] Guardar sessão em estado pra usar em `route.ts` (header Authorization)

### Envio de token (`src/app/api/chat/route.ts`)

- [ ] Ler `Authorization` header: `request.headers.get('authorization')`
- [ ] Repassar pro MCP: `new StreamableHTTPClientTransport({ url, requestInit: { headers: { Authorization: authHeader } } })`
- [ ] Se sem header: retornar erro 401 (ou deixar vazio e MCP rejeita)

### Testes manuais

- [ ] Fluxo novo: cadastro → login → chat (token viaja no header)
- [ ] Token expirado: editar localStorage pra token fake, enviar mensagem, verificar erro
- [ ] Redirecionamento: entrar em `http://localhost:3000/` sem session → redireciona pra `/login`
- [ ] Erro de CPF duplicado: tentar cadastrar 2x mesma pessoa → mensagem aparece
- [ ] Erro de credenciais: login com senha errada → mensagem aparece

---

## Integração + Validação

- [ ] Conferir que ambos `api-auth` e `mcp-server` têm **idêntico** `JWT_SECRET` em `.env`
- [ ] Rodar `npm run check` em `api-auth/` (testes + cobertura 80%)
- [ ] Rodar `npm run check` em `chat-web/` (lint + typecheck)
- [ ] Testar ponta-a-ponta: usuário novo → cadastro → login → chat → enviar mensagem
- [ ] Coordenar com Task B: confirmar que `mcp-server` chama `GET /usuarios/me/limite` antes de `realizar_compra`

---

## Pronto pra PR?

- [ ] Todos os itens acima estão marcados
- [ ] Branch está atualizada com `develop` (sem conflitos)
- [ ] `npm run check` passa em ambos pacotes
- [ ] Fluxo manual foi testado
