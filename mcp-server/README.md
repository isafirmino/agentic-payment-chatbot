# ollama-tools

Servidor **MCP** com as ferramentas que o modelo do `ollama-chat` pode chamar. Fica num
processo separado de propósito: o chat nunca executa código de ferramenta, ele só sabe pedir.

```bash
npm install
npm start     # http://localhost:4000/mcp
npm run check # self-check + typecheck
```

Transporte: Streamable HTTP, modo stateless (sem sessão para expirar). Endpoint único:
`POST /mcp`, falando JSON-RPC.

| Ferramenta | O que faz |
| --- | --- |
| `get_time` | `{ "timezone": "America/Sao_Paulo" }` → data e hora ali. Sem argumento, devolve o horário de Brasília (UTC-3). |
| `list_items` | `{ "search": "playstation" }` → itens que batem com o filtro e seus preços em BRL. Sem `search`, devolve tudo. |

O chat acha o servidor em `MCP_URL` (padrão `http://localhost:4000/mcp`). Se ele não
estiver no ar, o chat continua respondendo — só que sem ferramentas.

Como é MCP de verdade, qualquer cliente MCP (Claude Desktop, Claude Code, outro agente)
consegue usar as mesmas ferramentas sem que este projeto saiba quem é o cliente.

## Banco compartilhado

Este serviço e o `api-auth` leem e escrevem no **mesmo arquivo** SQLite
(ver [ADR 0003](../docs/adr/0003-sqlite-compartilhado-entre-servicos.md)).
Antes de subir, copie o exemplo de configuração:

```bash
cp .env.example .env
```

`DATABASE_PATH` é resolvido a partir da raiz **deste pacote**, não de onde
você rodou o comando — então o padrão `../data/app.db` cai sempre em
`<repo>/data/app.db`. Se mudar aqui, mude igual no `.env` do `api-auth`:
os dois precisam do mesmo arquivo, senão o limite de gasto gravado no
cadastro não é o mesmo que a compra valida.

Pra conferir que está tudo certo, a partir da raiz do repositório:

```bash
node scripts/verify-shared-db.mjs
```

A divisão de tabelas é: `produtos`, `intencoes` e `transacoes` pertencem a
este serviço; `usuarios` pertence ao `api-auth`. Cada serviço cria as suas
no próprio boot, com `CREATE TABLE IF NOT EXISTS` — não há migration
compartilhada. Nenhuma delas existe ainda: cada uma chega junto com a
feature que a implementa.

O que cada arquivo faz:

- `src/tools.ts` — o que as ferramentas fazem. Não sabe o que é MCP.
- `src/server.ts` — registra as duas no MCP e sobe o transporte.
- `src/tools.check.ts` — `node src/tools.check.ts`, roda sozinho e falha se a lógica quebrar.
- `src/db.ts` — abre a conexão com o banco compartilhado. Não cria tabela.
