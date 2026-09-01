# chat-web

Frontend do projeto. É a interface de chat que conversa com um provedor de LLM e usa o MCP para executar compras autenticadas.

## O que faz

- valida sessão do usuario via JWT
- integra com o `api-auth` para cadastro e login
- chama o MCP para consultar e executar ferramentas
- escolhe Ollama ou OpenRouter conforme disponibilidade
- envia o historico completo da conversa para o modelo

## Variaveis relevantes

- `NEXT_PUBLIC_AUTH_URL` default `http://localhost:3001`
- `MCP_URL` default `http://localhost:4000/mcp`
- `OLLAMA_URL` default `http://localhost:11434`
- `OLLAMA_MODEL` default `qwen2.5:14b`
- `OPENROUTER_API_KEY` para fallback
- `OPENROUTER_MODEL` default `openrouter/free`

## Como rodar

```bash
cd chat-web
npm install
cp .env.example .env
npm run dev
```

A interface fica em `http://localhost:3000`.

## Observacao

As instrucoes completas de execucao do projeto e a ordem de subida dos tres servicos estao no README raiz.

Veja tambem:
- [README raiz](../README.md)
- [api-auth](../api-auth/README.md)
- [mcp-server](../mcp-server/README.md)
