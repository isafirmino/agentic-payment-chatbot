---
name: to-spec
description: "Transforma a conversa atual (já grillada) em spec + plan + tasks salvos em specs/: sem entrevista nova, só síntese do que já foi discutido."
disable-model-invocation: true
---

Este skill pega o entendimento já alcançado na conversa (idealmente depois
de rodar `grill-me`/`grilling`) e a exploração do código atual, e produz três
arquivos. NÃO entreviste o usuário de novo aqui — se algo ainda está em
aberto, pare e sugira rodar `grill-me` primeiro.

Não existe issue tracker externo neste projeto: o spec vive no próprio
repositório, em `specs/`.

## Processo

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
