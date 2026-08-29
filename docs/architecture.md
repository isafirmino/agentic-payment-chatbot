# Arquitetura

Este documento registra o que já está decidido. Decisões novas viram um ADR
em `docs/adr/` (veja `docs/adr/TEMPLATE.md`) em vez de serem adicionadas
direto aqui.

## Visão geral

O desafio (`docs/desafio.md`) define o formato do sistema:

```
Frontend (chat) → Backend (auth + agente + MCP client) → Servidor MCP (3 tools)
```

Três processos separados, cada um com uma responsabilidade única:

| Pasta | Papel | Origem |
|---|---|---|
| `chat-web/` | Frontend de chat | cópia de `ollama-chat/` |
| `api-auth/` | Backend: autenticação | cópia de `auth/` |
| `mcp-server/` | Servidor MCP com as tools | cópia de `ollama-tools/` |

Ver `docs/adr/0001-base-a-partir-dos-workshops.md` para o porquê de começar
copiando esses três projetos em vez de escrever do zero.

## Por que processos separados

O frontend nunca executa lógica de ferramenta — ele só conversa com o
backend, que decide quando chamar o agente e quais tools existem. O servidor
MCP é o único lugar que sabe como listar catálogo, registrar intenção e
realizar compra; qualquer cliente MCP (não só este chat) pode falar com ele
usando o mesmo protocolo.

Isso ainda não inclui como a lógica de pagamento (catálogo, limite,
validação de intenção, qual LLM usar) vai ser implementada — essas decisões
nascem como feature própria, seguindo o fluxo spec → plan → tasks descrito
em `CONTRIBUTING.md`, e cada uma relevante vira seu próprio ADR.
