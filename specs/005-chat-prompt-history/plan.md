# Plano técnico — Prompt do chat e histórico completo

Fatos verificados antes de planejar:

- `chat-web` roda Next 16.3.2. Conferi em
  `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  que `'use client'` + `useState` seguem iguais — nada do que esta feature
  toca mudou nesta versão (o `chat-web/AGENTS.md` pede essa checagem).
- `chat-web/src/app/page.tsx:31` inicializa `active` como `'stateless'`:
  o modo que viola o desafio é o **padrão** ao abrir a tela.
- A branch `feat/05/auth-login-jwt` mexe no mesmo arquivo e **reformatou-o
  inteiro** (commit `103f019`, prettier com aspas duplas e ponto e vírgula).
  Ela mantém o prompt antigo e o seletor. Conflito de merge é certo; a
  combinação é ela rebasear, por ainda não ter PR aberta.
- O `check` do `chat-web` hoje roda apenas `src/lib/llm/*.check.ts` — o
  glob precisa alcançar o módulo novo.

## Ordem de implementação

### 1. `chat-web/src/lib/chat/payload.ts` (novo)

Exporta:

- `SYSTEM_PROMPT: Message` — o prompt do sistema, movido de
  `page.tsx:12-19` e reescrito.
- `buildPayload(history: Message[], userText: string): Message[]` — função
  pura, devolve `[SYSTEM_PROMPT, ...history, { role: 'user', content: userText }]`.

Reaproveita o tipo `Message` de `chat-web/src/lib/llm/types.ts`, que é o
que a rota `/api/chat` já consome — não criar um tipo paralelo.

Conteúdo do prompt, conforme o `spec.md`: as três ferramentas pelo nome
(`listar_catalogo`, `registrar_intencao`, `realizar_compra`), quando usar
cada uma, a ordem obrigatória entre elas, `cartao`/`pix`, o prazo vindo de
`valido_por_minutos`, proibição de inventar identificador ou preço, e uma
linha por código de recusa dizendo o que explicar e o que oferecer.

Os códigos de recusa de `realizar_compra` vêm de `docs/desafio.md`; os de
`registrar_intencao` (`PRODUTO_INEXISTENTE`, `QUANTIDADE_INVALIDA`,
`ESTOQUE_INSUFICIENTE`) vêm do ADR de catálogo e intenção, ainda em
revisão — se mudarem lá, é só texto a ajustar aqui.

### 2. `chat-web/src/lib/chat/payload.check.ts` (novo)

Mesmo padrão de `chat-web/src/lib/llm/openrouter.check.ts` (`node:test` +
`node:assert/strict`, import com extensão `.ts`).

Cobre `buildPayload`: prompt do sistema sempre primeiro; histórico
preservado na ordem; mensagem nova por último; histórico vazio; e histórico
longo não truncado. Cobre `SYSTEM_PROMPT`: cita as três ferramentas e os
dois métodos, e não cita `get_time` nem `list_items`.

### 3. `chat-web/package.json`

Trocar o glob do script `check` de `src/lib/llm/*.check.ts` para alcançar
também `src/lib/chat/`. Confirmar que o padrão escolhido funciona de fato
no `node --test` desta versão antes de fechar.

### 4. `chat-web/src/app/page.tsx`

Remoções:

- `type ChatId` (linha 10), a constante `CHATS` (21-24) e os dois botões
  que ela renderiza (106-123).
- O estado `chats: Record<ChatId, Turn[]>` (27-30) vira `messages: Turn[]`.
- O estado `active` (31) e a derivação `messages = chats[active]` (37).
- O helper `setChat(id, next)` (47-49), que só existe para escolher em qual
  das duas conversas escrever.
- O ternário do payload (58-59) e o texto condicional de tela vazia
  (126-132), que passa a ter uma versão só.

Substituições:

- A constante `SYSTEM` local passa a vir de `@/lib/chat/payload`.
- A montagem do payload passa a ser `buildPayload(history, input)`.

Manter, sem mexer na lógica: o `peek`, o `closeTimer`, o `showPeek`/
`hidePeek` e todo o painel lateral (166-191), que é a evidência exigida
pela entrega.

### 5. Painel de evidência — fixar com clique

No `div` da mensagem do usuário (134-142), acrescentar `onClick` que
alterna entre fixado e não fixado. Enquanto fixado, `hidePeek` não fecha.
Um estado extra (`pinned: boolean`) resolve; o comportamento de passar o
mouse continua igual quando não está fixado.

Deixar visível na tela que dá para clicar, já que hoje o `cursor-help`
sugere só passar o mouse.

### 6. Verificação

- `npm run check` no `chat-web` (testes novos + `tsc --noEmit`).
- `npm run lint`, que o pacote tem e os outros não.
- Manual: subir `mcp-server` e `chat-web`, confirmar que o seletor sumiu,
  que o painel abre no clique e continua abrindo no hover, e que o
  histórico cresce a cada turno dentro do painel.
- A conversa completa de compra só dá para verificar depois que
  `realizar_compra` existir; registrar isso como pendente.
