# chat-web

Chat em Next.js que conversa com um LLM, com streaming token a token e
ferramentas vindas de um servidor MCP separado (`../mcp-server`).
O acesso exige cadastro e login no `api-auth`; o JWT emitido viaja no header
`Authorization` até o MCP, que valida assinatura, expiração e identidade.

Dois provedores de LLM, escolhidos automaticamente (ver
`docs/adr/0002-provedor-llm-ollama-com-fallback-openrouter.md`):

1. **Ollama local** (padrão) — usado se `OLLAMA_URL` responder.
2. **OpenRouter** (fallback) — usado automaticamente se o Ollama não estiver
   acessível. Precisa de `OPENROUTER_API_KEY` configurada.

Essa escolha é feita **uma vez**, na primeira mensagem processada pelo
servidor, e fica em cache pro resto do processo — reinicie `npm run dev`
pra forçar uma nova checagem (ex.: depois de ligar o Ollama).

O histórico completo é enviado em todas as mensagens. Passe o mouse por
cima de uma mensagem sua e um painel abre à direita mostrando **exatamente**
o que foi enviado ao modelo naquele turno, incluindo o system prompt e as
ferramentas chamadas, com argumentos e retorno. O histórico vive só na
memória da aba; o `localStorage` guarda apenas a sessão autenticada.

## Como rodar

```bash
# terminal 1 — autenticação
cd ../api-auth && npm ci && npm run dev

# terminal 2 — ferramentas autenticadas
cd ../mcp-server && npm install && npm start

# terminal 3 — chat
npm install
cp .env.example .env   # preencha OPENROUTER_API_KEY se não for usar Ollama
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Use o mesmo `JWT_SECRET` nos `.env` de `api-auth` e `mcp-server`. Suba os
dois serviços antes de conversar. Se o MCP estiver indisponível, o chat
retorna 503 e não chama o LLM porque não consegue validar a sessão. Ollama é
opcional: o OpenRouter assume se sua chave estiver configurada.

### Variáveis de ambiente

Copie `.env.example` pra `.env` (carregado automaticamente via `dotenv`).

| Variável | Padrão | O que é |
| --- | --- | --- |
| `NEXT_PUBLIC_AUTH_URL` | `http://localhost:3001` | API usada pelas telas de cadastro e login. |
| `OLLAMA_URL` | `http://localhost:11434` | Onde o Ollama escuta. |
| `OLLAMA_MODEL` | `qwen2.5:14b` | Modelo usado no Ollama. Precisa suportar ferramentas. |
| `MCP_URL` | `http://localhost:4000/mcp` | Servidor MCP com as ferramentas. |
| `OPENROUTER_API_KEY` | — (obrigatória pro fallback) | Chave gratuita em [openrouter.ai/keys](https://openrouter.ai/keys). |
| `OPENROUTER_MODEL` | `openrouter/free` | Modelo usado no OpenRouter. `openrouter/free` é o auto-router que escolhe um modelo gratuito disponível no momento (o roster de free muda com frequência); free tier: 20 req/min, 200/dia. |

### Outros modelos que aceitam tools

Um modelo pequeno que suporta ferramentas: [llama3.2](https://ollama.com/library/llama3.2).

```bash
ollama pull llama3.2          # 3B, o padrão da página
echo 'OLLAMA_MODEL=llama3.2' >> .env.local
```

Para conferir se um modelo qualquer sabe chamar ferramenta, procure `tools` aqui:

```bash
ollama show llama3.2 | grep -i capabilities -A3
```

Quanto menor o modelo, mais ele erra a decisão de chamar a ferramenta.

## O Ollama já está rodando

Na maioria das instalações o Ollama sobe como serviço junto com o sistema. Por isso
`ollama serve` responde `bind: address already in use` — esse erro quer dizer "já está no
ar", não "falhou". Não rode.

```bash
curl -s localhost:11434/api/version   # respondeu = está no ar
sudo systemctl start ollama           # só se não estiver
```

## Monitorando

A primeira pergunta depois de alguns minutos parados demora bem mais que as outras. Não é
o chat travando: o Ollama descarrega o modelo da memória depois de ~5 minutos ocioso, e a
próxima pergunta paga o carregamento de novo. Dá para ver isso acontecendo:

```bash
watch -n1 ollama ps        # se está carregado, se está na GPU ou na CPU, e quando expira
journalctl -u ollama -f    # cada requisição chegando, mais as linhas de carga/descarga
```

`ollama ps` é o que responde "por que está demorando". Tabela vazia = modelo frio, a próxima
pergunta vai demorar. Coluna `UNTIL` com tempo = quente, responde na hora. E se o
`PROCESSOR` disser `CPU` em vez de `GPU`, o modelo não coube na placa e a resposta vai levar
minutos em vez de segundos — aí vale usar um modelo menor.

Para não descarregar no meio de uma demonstração, mande o modelo ficar na memória em
`src/app/api/chat/route.ts`:

```ts
body: JSON.stringify({ model: MODEL, messages: convo, tools, stream: true, keep_alive: -1 }),
```

`-1` mantém carregado até o Ollama reiniciar; `'30m'` é a versão educada.

## Como funciona por dentro

`src/app/api/chat/route.ts` é o único caminho até o modelo. Ele:

1. Exige Bearer token, abre uma conexão autenticada com o `mcp-server` e
   traduz as ferramentas pro formato de function-calling. Sem token retorna
   401; sem MCP para validá-lo retorna 503, sem chamar o LLM.
2. Chama `pickProvider()` (`src/lib/llm/index.ts`), que decide entre Ollama
   (`src/lib/llm/ollama.ts`) e OpenRouter (`src/lib/llm/openrouter.ts`) e
   repassa os tokens pro navegador em NDJSON, independente de qual dos
   dois respondeu.
3. Se o modelo pedir uma ferramenta, executa via MCP, devolve o resultado para a conversa e
   chama o modelo de novo — no máximo `MAX_ROUNDS` vezes, senão ele fica em loop.
4. Segura os primeiros tokens de cada rodada por `HOLD_MS`. Modelos pequenos costumam
   rascunhar em voz alta antes de decidir chamar a ferramenta, às vezes em outro idioma;
   se a chamada aparecer, esse rascunho é descartado em vez de piscar na tela.

`src/app/page.tsx` é o cliente inteiro: estado em memória, leitura do stream, e o painel
lateral. O system prompt fica **no cliente**, de propósito, para que o painel mostre a carga
real enviada, sem nada escondido no servidor.
