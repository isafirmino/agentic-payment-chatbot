# Tarefas — Prompt do chat e histórico completo

- [x] Criar `chat-web/src/lib/chat/payload.ts` com `SYSTEM_PROMPT` e
      `buildPayload`, reaproveitando o tipo `Message` de `src/lib/llm/types.ts`
- [x] Escrever o novo prompt do sistema: as 3 tools pelo nome, ordem
      obrigatória entre elas, `cartao`/`pix`, prazo da intenção, proibição
      de inventar id/preço, e uma instrução por código de recusa
- [x] Criar `chat-web/src/lib/chat/payload.check.ts` cobrindo `buildPayload`
      (prompt primeiro, histórico na ordem, mensagem nova por último,
      histórico vazio, histórico longo sem truncar) e o conteúdo do
      `SYSTEM_PROMPT`
- [x] Ajustar o glob do script `check` em `chat-web/package.json` para
      alcançar `src/lib/chat/`, confirmando que funciona no `node --test`
- [x] Rodar `next typegen` antes do `tsc` no `check`: `layout.tsx` usa
      `LayoutProps`, que é tipo gerado, e o typecheck falhava num clone
      limpo mesmo antes desta feature
- [x] Remover `ChatId`, `CHATS`, o estado `active` e o `setChat` de
      `chat-web/src/app/page.tsx`, deixando um único fluxo com histórico
- [x] Trocar a montagem do payload em `page.tsx` por `buildPayload`
- [x] Remover os botões de troca de modo e o texto condicional de tela vazia
- [x] Permitir fixar o painel "Enviado ao modelo" com um clique, mantendo o
      comportamento de passar o mouse
- [x] Incluir as chamadas de ferramenta e seus resultados no histórico dos
      turnos seguintes (`toHistory`), fechando a segunda metade do critério
      obrigatório do desafio, com teste cobrindo a expansão e a ordem
- [x] Registrar no `spec.md` a sugestão de abrir o painel pelo teclado como
      melhoria pós-entrega
- [x] Rodar `npm run check` e `npm run lint` no `chat-web` e garantir que
      passam
- [x] Verificar que a página sobe e que o seletor sumiu do HTML servido
- [ ] Verificar manualmente no navegador: painel abre no hover, fixa no
      clique, e o histórico cresce a cada turno
- [ ] Verificar a conversa de compra de ponta a ponta — **pendente**: depende
      de `listar_catalogo`/`registrar_intencao` (PR #12) e de
      `realizar_compra` (task #8) estarem em `develop`
- [ ] Avisar quem está na task #5 sobre o conflito em `page.tsx` e combinar
      a ordem de merge
- [ ] Rodar `pr-review` antes de abrir a PR
