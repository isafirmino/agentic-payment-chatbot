# mcp-server

Servico MCP do projeto. Expõe as tools que o agente usa para consultar catalogo, registrar intencoes e confirmar compras.

## O que faz

- `listar_catalogo`: mostra produtos disponiveis
- `registrar_intencao`: cria intencao vinculada ao usuario autenticado e a conversa atual
- `realizar_compra`: valida o pagamento e grava a transacao quando aprovado

## Regras centrais

- exige `Authorization: Bearer <jwt>`
- exige `X-Conversa-Id` nas tools de intencao
- valida o CPF vind do JWT, nunca do argumento da tool
- recalcula limite e estoque no backend antes de aprovar
- usa o mesmo SQLite do `api-auth`

## Variaveis relevantes

- `PORT` default `4000`
- `JWT_SECRET` precisa bater com o do `api-auth`
- `DATABASE_PATH` default `../data/app.db`

## Endpoint principal

```text
POST http://localhost:4000/mcp
```

## Observacao

As instrucoes completas de execucao do projeto, incluindo a subida dos tres servicos, estao no README raiz.

Para rodar o servico isolado:

```bash
cd mcp-server
npm install
cp .env.example .env
npm run dev
```

Veja tambem:
- [README raiz](../README.md)
- [api-auth](../api-auth/README.md)
- [chat-web](../chat-web/README.md)
