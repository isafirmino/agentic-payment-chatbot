# Tarefas — Prompt do chat e histórico completo

- [ ] Criar `chat-web/src/lib/chat/payload.ts` com `SYSTEM_PROMPT` e
      `buildPayload`, reaproveitando o tipo `Message` de `src/lib/llm/types.ts`
- [ ] Escrever o novo prompt do sistema: as 3 tools pelo nome, ordem
      obrigatória entre elas, `cartao`/`pix`, prazo da intenção, proibição
      de inventar id/preço, e uma instrução por código de recusa
- [ ] Criar `chat-web/src/lib/chat/payload.check.ts` cobrindo `buildPayload`
      (prompt primeiro, histórico na ordem, mensagem nova por último,
      histórico vazio, histórico longo sem truncar) e o conteúdo do
      `SYSTEM_PROMPT`
- [ ] Ajustar o glob do script `check` em `chat-web/package.json` para
      alcançar `src/lib/chat/`, confirmando que funciona no `node --test`
- [ ] Remover `ChatId`, `CHATS`, o estado `active` e o `setChat` de
      `chat-web/src/app/page.tsx`, deixando um único fluxo com histórico
- [ ] Trocar a montagem do payload em `page.tsx` por `buildPayload`
- [ ] Remover os botões de troca de modo e o texto condicional de tela vazia
- [ ] Permitir fixar o painel "Enviado ao modelo" com um clique, mantendo o
      comportamento de passar o mouse
- [ ] Rodar `npm run check` e `npm run lint` no `chat-web` e garantir que
      passam
- [ ] Verificar manualmente: seletor sumiu, painel abre no clique e no
      hover, e o histórico cresce a cada turno
- [ ] Avisar quem está na task #5 sobre o conflito em `page.tsx` e combinar
      a ordem de merge
- [ ] Rodar `pr-review` antes de abrir a PR
