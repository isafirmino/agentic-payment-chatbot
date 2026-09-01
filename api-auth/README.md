# api-auth — cadastro, login e limite de gasto

API Express + TypeScript com **JWT** (HS256) e senhas com hash **scrypt**.
Cadastro e login por **CPF**, sem roles — o único identificador é o CPF, e
ele vira o `sub` do JWT. Dados ficam num SQLite compartilhado com o
`mcp-server` (ver seção abaixo), não em memória: usuário e limite de gasto
sobrevivem a um restart.

```bash
npm install
cp .env.example .env
npm run dev     # http://localhost:3001
```

### Configuração

| Variável | Default | Descrição |
|----------|---------|-----------|
| `PORT` | `3001` | porta HTTP (3000 é do `chat-web`, por isso o default aqui é diferente) |
| `JWT_SECRET` | fallback apenas em desenvolvimento | chave de assinatura compartilhada com o `mcp-server`. Em produção é obrigatória; use o mesmo valor nos dois `.env`. Trocar o segredo invalida os tokens emitidos anteriormente. |
| `DATABASE_PATH` | `../data/app.db` | banco SQLite compartilhado com o `mcp-server` — ver abaixo |
| `DEFAULT_LIMITE_CENTS` | `100000` | limite não negativo em centavos atribuído a todo usuário novo. Zero é aceito; valor negativo, fracionário ou inválido impede o boot. |
| `CORS_ORIGIN` | `http://localhost:3000` | origem do `chat-web` liberada no CORS. Sem isso (ou com valor errado), o navegador bloqueia `fetch` de `/auth/cadastro` e `/auth/login` com `Failed to fetch`, mesmo com o backend respondendo certo. |

Tokens expiram em **1h** (`expiresIn` vem na resposta do login). Não há
refresh token: expirado, é preciso logar de novo.

## Banco compartilhado

Este serviço e o `mcp-server` leem e escrevem no **mesmo arquivo** SQLite
(ver [ADR 0003](../docs/adr/0003-sqlite-compartilhado-entre-servicos.md)).

`DATABASE_PATH` é resolvido a partir da raiz **deste pacote**, não de onde
você rodou o comando — então o padrão `../data/app.db` cai sempre em
`<repo>/data/app.db`. Se mudar aqui, mude igual no `.env` do `mcp-server`:
os dois precisam do mesmo arquivo, senão o limite de gasto gravado no
cadastro não é o mesmo que a compra valida.

Pra conferir que está tudo certo, a partir da raiz do repositório:

```bash
node scripts/verify-shared-db.mjs
```

A divisão de tabelas é: `usuarios` pertence a este serviço; `produtos`,
`intencoes` e `transacoes` pertencem ao `mcp-server`. Cada serviço cria as
suas no próprio boot, com `CREATE TABLE IF NOT EXISTS` — não há migration
compartilhada.

## Endpoints

| Método | Rota                    | Acesso    |
|--------|-------------------------|-----------|
| GET    | `/health`               | público   |
| POST   | `/auth/cadastro`        | público   |
| POST   | `/auth/login`           | público   |
| GET    | `/usuarios/me/limite`   | JWT válido |

`GET /usuarios/me/limite` existe por ser critério de aceite desta task, mas
**não** é o mecanismo que o `mcp-server` usa pra validar limite antes de uma
compra — `realizar_compra` lê `usuarios.limite_cents` direto do banco
compartilhado (ver [ADR 0004](../docs/adr/0004-authentication-jwt-cpf.md)).

## Erros

| Status | Quando |
|--------|--------|
| 400 | body inválido no cadastro/login (campo ausente ou vazio) |
| 400 | cadastro com CPF já existente |
| 401 | login com CPF ou senha errados |
| 401 | `/usuarios/me/limite` sem token, com token inválido ou expirado |
| 404 | `/usuarios/me/limite` com token válido de um CPF que não existe mais |
| 500 | erro inesperado (não deveria acontecer em uso normal) |

---

## cURLs

### 1. Health check (sem auth)

```bash
curl http://localhost:3001/health
# {"status":"ok","uptime":12.3}
```

### 2. Cadastro

```bash
curl -X POST http://localhost:3001/auth/cadastro \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Alice","cpf":"11111111111","senha":"alice123"}'
# {"message":"cadastro realizado"}
```

Cadastrar o mesmo CPF de novo dá `400`:

```bash
curl -i -X POST http://localhost:3001/auth/cadastro \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Alice","cpf":"11111111111","senha":"alice123"}'
# HTTP/1.1 400 Bad Request — {"error":"CPF já cadastrado"}
```

### 3. Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"cpf":"11111111111","senha":"alice123"}'
# {"token":"eyJhbGciOiJIUzI1NiIs...","cpf":"11111111111","nome":"Alice","expiresIn":"1h"}
```

O token é um JWT — cole em [jwt.io](https://jwt.io) pra ver as claims
(`sub` = CPF, sem `role`, sem limite).

Guarde o token numa variável:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"cpf":"11111111111","senha":"alice123"}' | jq -r .token)
```

### 4. Consultar limite de gasto

```bash
curl http://localhost:3001/usuarios/me/limite -H "Authorization: Bearer $TOKEN"
# {"limite_cents":100000}
```

Sem token, ou com token adulterado, dá `401`:

```bash
curl -i http://localhost:3001/usuarios/me/limite -H "Authorization: Bearer ${TOKEN}x"
# HTTP/1.1 401 Unauthorized
```

### Provando que o token sobrevive ao restart

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"cpf":"11111111111","senha":"alice123"}' | jq -r .token)

# mate o servidor (Ctrl+C) e suba de novo: npm run dev

curl http://localhost:3001/usuarios/me/limite -H "Authorization: Bearer $TOKEN"
# 200 — o mesmo token continua valendo, porque JWT é stateless
```
