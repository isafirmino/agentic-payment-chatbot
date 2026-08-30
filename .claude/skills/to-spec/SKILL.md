---
name: to-spec
description: "Transforma a conversa atual (já grillada) em spec + plan + tasks salvos em specs/: sem entrevista nova, só síntese do que já foi discutido. Invoque automaticamente assim que uma sessão de grilling/grill-me terminar (fronteira vazia) e o usuário confirmar que chegaram a um entendimento compartilhado — não é preciso esperar o usuário digitar /to-spec."
---

Este skill pega o entendimento já alcançado na conversa (idealmente depois
de rodar `grill-me`/`grilling`) e a exploração do código atual, e produz três
arquivos. NÃO entreviste o usuário de novo aqui — se algo ainda está em
aberto, pare e sugira rodar `grill-me` primeiro.

Não existe issue tracker externo neste projeto: o spec vive no próprio
repositório, em `specs/`.

## Feature nova ou emenda?

Antes de tudo, decida isso — muda o resto do processo:

- **Feature nova**: o comportamento discutido não tem spec cobrindo ele
  ainda. Segue o processo normal (abaixo): cria `specs/<NNN>-<slug>/` novo.
- **Emenda**: a conversa altera, corrige ou estende comportamento que um
  `spec.md` já existente descreve (a `grilling` já deve ter sinalizado isso
  e apontado o candidato). Confirme com o usuário qual `specs/<NNN>-<slug>/`
  é, se ainda não estiver claro, e siga o processo de emenda: **## Emenda a
  spec existente**, abaixo — não crie pasta nova.

Na dúvida (a mudança é grande o suficiente que parece feature própria,
mesmo tocando em algo já especificado): pergunte ao usuário, não decida
sozinho.

## Processo (feature nova)

1. Explore o repo o quanto for preciso pra entender o estado atual das
   pastas envolvidas (`chat-web/`, `api-auth/`, `mcp-server/`, conforme a
   feature). Respeite os ADRs existentes em `docs/adr/` — se a feature
   contradiz um ADR aceito, isso é uma decisão nova e deve virar outro ADR,
   não ser ignorado.
2. Escolha o próximo número de feature: olhe `specs/` e pegue o maior `NNN-*`
   existente + 1 (comece em `001` se não houver nenhum ainda). Escolha um
   `slug` curto em kebab-case.
3. Crie `specs/<NNN>-<slug>/` copiando a forma de `specs/TEMPLATE/` e
   preencha os três arquivos abaixo.
4. Confirme com o usuário que os três arquivos refletem o que foi discutido
   antes de considerar a feature pronta pra implementação.

## Emenda a spec existente

Não crie pasta nova nem renumere nada — a spec existente continua sendo a
mesma feature, só ganha uma revisão. No `specs/<NNN>-<slug>/` já
identificado:

1. Em `spec.md`, acrescente uma seção `## Emenda — <YYYY-MM-DD>` no final
   do arquivo com: o que muda (nova user story, story revisada, novo caso
   de erro, mudança de decisão de implementação/teste) e o porquê. Não
   reescreva silenciosamente o que já existia — se uma decisão anterior foi
   revertida, deixe isso explícito na emenda em vez de apagar o rastro.
2. Atualize `plan.md` se a abordagem técnica muda (esse arquivo não tem
   histórico — reflete só o estado atual do plano).
3. Acrescente os novos itens em `tasks.md` (`- [ ] ...`) sem mexer nos itens
   já marcados como feitos.
4. Confirme com o usuário que a emenda reflete o que foi discutido antes de
   considerar pronta pra implementação.

<spec-template nome-do-arquivo="spec.md">

## Problema

O problema que o usuário enfrenta, do ponto de vista dele.

## Solução

A solução, do ponto de vista do usuário — não é a implementação técnica.

## User stories

Lista numerada, formato `Como <ator>, eu quero <funcionalidade>, para que
<benefício>`. Cubra o caminho feliz e os casos de erro relevantes
(ex.: limite excedido, intenção inválida) como stories próprias.

## Decisões de implementação

Módulos afetados, contratos entre serviços, mudanças de schema — decisões,
não código. Sem caminho de arquivo nem trecho de código (isso fica no
`plan.md`, que pode ficar desatualizado mais rápido).

## Decisões de teste

O que precisa ter teste, em que nível (unitário na lógica de negócio,
integração no contrato entre serviços), e o que pode ficar só como
verificação manual.

## Fora de escopo

O que essa feature explicitamente não resolve.

</spec-template>

<spec-template nome-do-arquivo="plan.md">

Abordagem técnica: arquivos/módulos a criar ou mudar, na ordem em que fazem
sentido implementar. Referencie funções/arquivos já existentes que devem
ser reaproveitados, com caminho. Pode ficar desatualizado — é um guia de
implementação, não um contrato.

</spec-template>

<spec-template nome-do-arquivo="tasks.md">

Checklist de execução, granular o suficiente pra cada item ser um commit
plausível. Formato:

```
- [ ] descrição da tarefa
```

Marque como feito (`- [x]`) conforme a implementação avança.

</spec-template>
