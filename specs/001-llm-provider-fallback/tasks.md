- [x] Adicionar `dotenv` como dependência de `chat-web/package.json`
- [x] Criar `chat-web/.env.example` com as 5 variáveis documentadas
- [x] Adicionar `!.env.example` no `chat-web/.gitignore`
- [x] Criar `chat-web/src/lib/llm/types.ts` com os tipos compartilhados
- [x] Extrair a lógica do Ollama pra `chat-web/src/lib/llm/ollama.ts`
      (`isOllamaReachable` + `streamOllama`), preservando o comportamento
      atual
- [x] Implementar `chat-web/src/lib/llm/openrouter.ts` (`streamOpenRouter`),
      incluindo parsing de SSE e acumulação de deltas de tool call
- [x] Implementar `chat-web/src/lib/llm/index.ts` (`pickProvider`)
- [x] Escrever `chat-web/src/lib/llm/openrouter.check.ts` cobrindo a lógica
      de parsing/acumulação sem depender de rede
- [x] Atualizar `chat-web/src/app/api/chat/route.ts` pra usar
      `pickProvider()` em vez do fetch hardcoded pro Ollama, e renomear
      `toOllamaTools` → `toProviderTools`
- [x] Atualizar `chat-web/README.md` com as variáveis novas e o
      comportamento de fallback
- [x] Escrever `docs/adr/0002-provedor-llm-ollama-com-fallback-openrouter.md`
- [ ] Testar manualmente: Ollama rodando (resposta local funciona), Ollama
      desligado + `OPENROUTER_API_KEY` configurada (fallback funciona), nem
      Ollama nem chave configurados (mensagem de erro clara aparece no chat)
