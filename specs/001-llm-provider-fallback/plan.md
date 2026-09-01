Abordagem técnica, na ordem em que faz sentido implementar. Tudo dentro de
`chat-web/`, exceto o ADR.

1. **`chat-web/package.json`** — adiciona `dotenv` como dependência. Sem
   CLI wrapper — os scripts `dev`/`start`/`build`/`lint` não mudam.

2. **`chat-web/.env.example`** — documenta as 5 variáveis
   (`OLLAMA_URL`, `OLLAMA_MODEL`, `MCP_URL`, `OPENROUTER_API_KEY`,
   `OPENROUTER_MODEL`) com valores de exemplo/placeholder, comentário
   curto em cada uma.

3. **`chat-web/.gitignore`** — adiciona `!.env.example` logo depois da
   linha `.env*`, pra ele não ficar ignorado junto com `.env`.

4. **`chat-web/src/lib/llm/types.ts`** — tipos compartilhados entre
   provedores: `Message`, `ToolCall`, `ProviderChunk`, `ProviderTool`
   (mover de dentro de `route.ts`, mesma forma que já existe hoje).

   Nota pros itens 5-7: cada módulo lê `process.env.X` **dentro das
   funções**, não no topo do arquivo — assim funciona não importa a ordem
   de import em relação ao `import 'dotenv/config'` do `route.ts`.

5. **`chat-web/src/lib/llm/ollama.ts`** — extrai a lógica que já existe em
   `route.ts` (fetch em `/api/chat`, parsing de NDJSON) pra uma função
   geradora `streamOllama(convo, tools, signal)`, comportamento idêntico
   ao atual. Adiciona `isOllamaReachable()`: `GET ${OLLAMA_URL}/api/version`
   com `AbortSignal.timeout(1500)`, retorna `boolean` (nunca lança).

6. **`chat-web/src/lib/llm/openrouter.ts`** — `streamOpenRouter(convo, tools, signal)`:
   - Monta o payload no formato `/chat/completions` (OpenAI-compatible),
     convertendo `convo` pro formato esperado — pareamento de
     `tool_call_id` feito posicionalmente (assistente com `tool_calls` →
     N mensagens `role: 'tool'` seguintes recebem o id correspondente),
     sem precisar mudar o tipo `Message`/`ToolCall` compartilhado.
   - Faz parsing das linhas `data: {...}` do SSE.
   - Acumula os deltas de `tool_calls` por índice (nome chega uma vez,
     `arguments` chega fragmentado como string e precisa ser concatenado),
     e só emite o `ProviderChunk` com `tool_calls` completo quando o
     stream termina.
   - Emite `ProviderChunk` com `content` a cada delta de texto (streaming
     real, não só no final).
   - Lança erro explícito se `OPENROUTER_API_KEY` não estiver definida.

7. **`chat-web/src/lib/llm/index.ts`** — `pickProvider()`: `async function`
   que chama `isOllamaReachable()` e devolve `streamOllama` ou
   `streamOpenRouter` (a função, não o resultado — quem chama decide
   quando iterar). O resultado da checagem é memoizado num módulo-level
   `let cached: StreamFn | undefined` — só a primeira chamada de
   `pickProvider()` de fato executa `isOllamaReachable()`; todas as
   seguintes devolvem o valor em cache, sem nova checagem, até o processo
   do servidor reiniciar.

8. **`chat-web/src/lib/llm/openrouter.check.ts`** — self-check no padrão
   de `mcp-server/src/tools.check.ts`: casos sintéticos de deltas SSE
   (múltiplos chunks, argumento fragmentado em 2+ pedaços, múltiplas tool
   calls no mesmo turno) verificando que a acumulação e o parse final
   batem com o esperado. Roda com `node` puro (Node 24 já suporta `.ts`
   nativo, sem precisar de `tsx` como dependência nova).

9. **`chat-web/src/app/api/chat/route.ts`** — adiciona `import 'dotenv/config'`
   como primeira linha do arquivo (garante que as variáveis já estão em
   `process.env` antes de qualquer outro import ler algo). Troca o bloco
   de fetch/parsing hardcoded pro Ollama por:
   ```ts
   const streamProvider = await pickProvider()
   // dentro do loop de rounds:
   for await (const chunk of streamProvider(convo, tools, request.signal)) { ... }
   ```
   O resto do loop (hold/flush, execução de tool via MCP, limite de
   rounds) não muda. Renomeia `toOllamaTools` → `toProviderTools` (a
   função já é agnóstica de provedor, só o nome estava desatualizado).

10. **`chat-web/README.md`** — documenta os dois provedores, o
    comportamento de fallback, as variáveis novas, o arquivo `.env`
    (`dotenv`, carregado automaticamente ao rodar `npm run dev`/`start`)
    e como gerar uma chave gratuita no OpenRouter.

11. **`docs/adr/0002-provedor-llm-ollama-com-fallback-openrouter.md`** —
    registra a decisão (Ollama primário + OpenRouter fallback + `dotenv`
    clássico), alternativas consideradas (NVIDIA NIM, `dotenvx`) e
    consequências.
