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

O que cada arquivo faz:

- `src/tools.ts` — o que as ferramentas fazem. Não sabe o que é MCP.
- `src/server.ts` — registra as duas no MCP e sobe o transporte.
- `src/tools.check.ts` — `node src/tools.check.ts`, roda sozinho e falha se a lógica quebrar.
