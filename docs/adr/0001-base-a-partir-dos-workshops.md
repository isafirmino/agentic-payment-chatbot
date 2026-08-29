# 0001 — Começar copiando os workshops em vez de escrever do zero

Status: aceita

## Contexto

O desafio (`docs/desafio.md`) pede um chatbot com frontend, backend
(auth + agente + cliente MCP) e um servidor MCP com 3 tools. O repo de
workshops `agentic-payments-fde-workshops` já tinha três projetos cobrindo
exatamente esses três papéis, validados em workshops anteriores:

- `auth/` — API Express com login JWT (HS256) e senha com scrypt.
- `ollama-tools/` — servidor MCP real (Streamable HTTP) com tools de
  exemplo.
- `ollama-chat/` — frontend de chat que conecta num LLM e num cliente MCP,
  com o loop de tool-calling já resolvido.

## Decisão

Copiar os três projetos como estão (sem alterar código) para este repo, só
renomeando a pasta de topo pro papel que cada um representa no diagrama do
desafio: `auth/` → `api-auth/`, `ollama-tools/` → `mcp-server/`,
`ollama-chat/` → `chat-web/`.

## Alternativas consideradas

- **Escrever os três serviços do zero** — descartada: reimplementaria login
  JWT, cliente MCP e loop de tool-calling que já existem, testados, sem
  ganho nenhum pro desafio em si.
- **Importar os três como dependência/submódulo do repo de workshops** —
  descartada: o desafio pede um repositório próprio, e as três peças vão
  divergir bastante do original (payload das tools, integração de auth com
  o chat, provedor de LLM) — copiar solto é mais simples do que manter
  sincronizado com um repo que não é o dono da feature.

## Consequências

- O código inicial de cada pasta ainda não faz nada específico do desafio
  (auth não conhece limite de gasto, `mcp-server` não tem as 3 tools do
  contrato, `chat-web` fala com Ollama e não tem login). Isso é esperado: a
  adaptação é a primeira feature real do time, decidida via
  `grill-me` → `to-spec`, não pré-decidida aqui.
- Cada pasta carrega o `README.md`/`AGENTS.md` original do workshop, que
  descreve um contexto (workshop de auth, workshop de tools) diferente do
  papel que a pasta passa a ter aqui. Esses READMEs devem ser atualizados
  como parte da feature que adaptar cada serviço, não antes.
