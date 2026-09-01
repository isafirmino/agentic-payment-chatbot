# api-auth

Servico de autenticacao do projeto. Responsavel por cadastro, login, JWT e limite de gasto do usuario.

## O que faz

- registra usuario com nome, CPF e senha
- valida senha com scrypt
- emite JWT com o CPF como subject
- persiste o limite do usuario em SQLite
- expõe a rota de consulta do limite por token

## Variaveis relevantes

- `PORT` default `3001`
- `JWT_SECRET` precisa ser igual ao do `mcp-server`
- `DATABASE_PATH` default `../data/app.db`
- `DEFAULT_LIMITE_CENTS` default `100000`
- `CORS_ORIGIN` default `http://localhost:3000`

## Endpoints principais

- `GET /health`
- `POST /auth/cadastro`
- `POST /auth/login`
- `GET /usuarios/me/limite`

## Observacao

As instrucoes completas de execucao do projeto, inclusive a subida dos tres servicos, estao centralizadas no README da raiz.

Para rodar em desenvolvimento do servico isolado:

```bash
cd api-auth
npm install
cp .env.example .env
npm run dev
```

Veja tambem:
- [README raiz](../README.md)
- [mcp-server](../mcp-server/README.md)
- [chat-web](../chat-web/README.md)

