# Payments API — auth em memória

API Express + TypeScript com **JWT** (HS256) e senhas com hash **scrypt**. Dados **em memória**: ao reiniciar, os pagamentos somem e os usuários voltam ao estado inicial — mas os **tokens continuam válidos**, porque JWT é stateless (o servidor só valida a assinatura, não guarda sessão).

```bash
npm install
npm run dev     # http://localhost:3000
```

### Configuração

| Variável | Default | Descrição |
|----------|---------|-----------|
| `PORT` | `3000` | porta HTTP |
| `JWT_SECRET` | `workshop-dev-secret-do-not-use-in-prod` | chave de assinatura. Mude em qualquer uso real — quem tem o secret forja token de admin. Trocar o secret invalida todos os tokens emitidos. |
| `DATABASE_PATH` | `../data/app.db` | banco SQLite compartilhado com o `mcp-server` — ver abaixo |

Tokens expiram em **1h** (`expiresIn` vem na resposta do login).

## Banco compartilhado

Este serviço e o `mcp-server` leem e escrevem no **mesmo arquivo** SQLite
(ver [ADR 0003](../docs/adr/0003-sqlite-compartilhado-entre-servicos.md)).
Antes de subir, copie o exemplo de configuração:

```bash
cp .env.example .env
```

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
compartilhada. Nenhuma delas existe ainda: cada uma chega junto com a
feature que a implementa.

## Usuários

Senhas são hasheadas com scrypt na inicialização; o texto puro abaixo existe só para você logar no workshop.

| username | password  | role  |
|----------|-----------|-------|
| alice    | alice123  | user  |
| bob      | bob123    | user  |
| root     | root123   | admin |

## Endpoints

| Método | Rota                | Acesso        |
|--------|---------------------|---------------|
| GET    | `/health`           | público       |
| POST   | `/auth/login`       | público       |
| POST   | `/auth/admin/login` | público       |
| POST   | `/payments`         | user + admin  |
| GET    | `/payments/:id`     | dono + admin  |
| GET    | `/payments`         | admin         |

---

## cURLs

### 1. Health check (sem auth)

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime":12.3}
```

### 2. Login como usuário comum

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"alice123"}'
# {"token":"eyJhbGciOiJIUzI1NiIs...","username":"alice","role":"user","expiresIn":"1h"}
```

O token é um JWT — cole em [jwt.io](https://jwt.io) para ver as claims (`sub`, `role`, `exp`).

Guarde o token numa variável:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"alice123"}' | jq -r .token)
```

### 3. Login como admin

```bash
ADMIN=$(curl -s -X POST http://localhost:3000/auth/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"root","password":"root123"}' | jq -r .token)
```

> Admin **não** loga em `/auth/login` e usuário comum **não** loga em `/auth/admin/login` — os dois retornam `401`.

### 4. Criar pagamento

`amount` é obrigatório e positivo. `currency` (default `BRL`) e `description` são opcionais.

```bash
curl -X POST http://localhost:3000/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":249.90,"currency":"BRL","description":"Fone Bluetooth"}'
# {"id":"a1b2...","owner":"alice","amount":249.9,"currency":"BRL","description":"Fone Bluetooth","createdAt":"..."}
```

Admin cria da mesma forma, trocando `$TOKEN` por `$ADMIN`.

### 5. Buscar pagamento por id

```bash
ID=a1b2...   # id retornado no passo anterior

curl http://localhost:3000/payments/$ID -H "Authorization: Bearer $TOKEN"
```

Admin lê qualquer pagamento:

```bash
curl http://localhost:3000/payments/$ID -H "Authorization: Bearer $ADMIN"
```

Outro usuário comum recebe `404` (não `403`, para não vazar quais ids existem):

```bash
BOB=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"bob","password":"bob123"}' | jq -r .token)

curl -i http://localhost:3000/payments/$ID -H "Authorization: Bearer $BOB"
# HTTP/1.1 404 Not Found
```

### 6. Listar todos os pagamentos (só admin)

```bash
curl http://localhost:3000/payments -H "Authorization: Bearer $ADMIN"
# {"payments":[{...},{...}]}
```

Usuário comum recebe `403`:

```bash
curl -i http://localhost:3000/payments -H "Authorization: Bearer $TOKEN"
# HTTP/1.1 403 Forbidden
```

## Erros

| Status | Quando |
|--------|--------|
| 400 | body inválido (sem `amount`, `amount <= 0`, tipos errados) |
| 401 | credenciais erradas, token ausente, adulterado ou expirado |
| 403 | usuário comum tentando rota de admin |
| 404 | pagamento inexistente ou de outro usuário |

### Provando que o token sobrevive ao restart

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"alice123"}' | jq -r .token)

# mate o servidor (Ctrl+C) e suba de novo: npm run dev

curl -X POST http://localhost:3000/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":10,"description":"pos-restart"}'
# 201 — o mesmo token continua valendo

curl -i http://localhost:3000/payments -H "Authorization: Bearer ${TOKEN}x"
# 401 — assinatura inválida
```

Os **pagamentos**, esses sim, somem no restart: `Map` em memória.
