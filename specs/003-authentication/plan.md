# Plan — Autenticação

## Abordagem técnica

Implementação em duas frentes paralelas: backend (`api-auth/`) e frontend (`chat-web/`), depois integração.

### 1. Backend (`api-auth/`)

**Ordem:**

1. **Atualizar schema SQLite** — Adicionar tabela `usuarios` no bootstrap de `api-auth/src/app.ts` usando a conexão de `db.ts` (Task 0)
2. **Implementar `POST /auth/cadastro`** — Validar entrada, hash scrypt, inserir com PRIMARY KEY, rejeitar duplicado
3. **Implementar `POST /auth/login`** — Buscar usuário, validar senha, emitir JWT com `{ sub: cpf, expiresIn: '1h' }`
4. **Implementar `GET /usuarios/me/limite`** — Middleware que valida JWT, extrai CPF, retorna limite_cents
5. **Limpar endpoints antigos** — Remover `/auth/admin/login`, `/payments`, `POST /auth/admin/...` (herdados do workshop)
6. **Testes** — `app.test.ts` cobrindo: cadastro (novo/duplicado), login (ok/erro), JWT, limite endpoint
7. **Documentação** — `.env.example` com `JWT_SECRET` marcado como compartilhado

### 2. Frontend (`chat-web/`)

**Ordem:**

1. **Criar `src/app/cadastro/page.tsx`** — Form nome/CPF/senha, `POST /auth/cadastro`, sucesso → redireciona pra `/login`, erro → mostra mensagem
2. **Criar `src/app/login/page.tsx`** — Form CPF/senha, `POST /auth/login`, sucesso → localStorage `chat_session` → `/`, erro → mostra mensagem
3. **Modificar `src/app/page.tsx`** — useEffect no mount: checa localStorage `chat_session`, se vazio redireciona pra `/login` antes de renderizar chat
4. **Modificar `src/app/api/chat/route.ts`** — Lê `Authorization` header, repassa pro MCP server via `requestInit: { headers: { Authorization } }`
5. **Adicionar env var** — `NEXT_PUBLIC_AUTH_URL` em `.env.example`
6. **Testes** — Verificação manual: fluxo completo cadastro→login→chat, sessão expirada

### 3. Integração

1. **Teste ponta-a-ponta** — Usuário novo: cadastro → login → chat → enviar mensagem (token viaja no header)
2. **Validação de limite** — Coordenar com Task B (mcp-server) pra confirmar que `GET /usuarios/me/limite` é chamado antes de `realizar_compra`

## Mudanças de arquivo

| Arquivo | Ação | Detalhes |
|---------|------|----------|
| `api-auth/src/app.ts` | modificar | Tabela usuarios no bootstrap, endpoints `/auth/cadastro`, `/auth/login`, `GET /usuarios/me/limite` |
| `api-auth/src/app.test.ts` | criar | Testes unitários (80% cobertura) |
| `api-auth/.env.example` | modificar | Documentar `JWT_SECRET` como compartilhado |
| `chat-web/src/app/cadastro/page.tsx` | criar | Nova página de cadastro |
| `chat-web/src/app/login/page.tsx` | criar | Nova página de login |
| `chat-web/src/app/page.tsx` | modificar | Gate client-side com useEffect |
| `chat-web/src/app/api/chat/route.ts` | modificar | Passar header Authorization pro MCP |
| `chat-web/.env.example` | modificar | Adicionar `NEXT_PUBLIC_AUTH_URL` |
| `docs/adr/0003-authentication-jwt-cpf.md` | criar | ADR registrando JWT sub=cpf, DEFAULT_LIMITE, compartilhamento de JWT_SECRET |

## Dependências externas

- ✅ Task 0 (SQLite compartilhado): precisa estar em `develop` antes de começar
- ⏳ Task B (mcp-server tools): vai consumir o endpoint `GET /usuarios/me/limite` (em paralelo, não bloqueante)

## Estimativa

- Backend: 3-4h (schema + 3 endpoints + testes)
- Frontend: 2-3h (3 páginas + gate + header)
- Integração + testes: 1h
- **Total: ~6-8h**
