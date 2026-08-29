---
mode: agent
description: Sintetiza a conversa atual (já grillada) em specs/<NNN>-<slug>/{spec.md,plan.md,tasks.md}.
---

Sintetize o entendimento já alcançado nesta conversa (idealmente depois de
rodar `/grill-me`) em três arquivos dentro de `specs/`. Não faça perguntas
novas de design aqui — se algo ainda está em aberto, pare e sugira rodar
`/grill-me` primeiro.

1. Olhe `specs/` e escolha o próximo número (`NNN` = maior existente + 1,
   ou `001` se não houver nenhum), e um `slug` curto em kebab-case.
2. Crie `specs/<NNN>-<slug>/` a partir da forma de `specs/TEMPLATE/`.
3. Preencha `spec.md`: Problema (visão do usuário), Solução (visão do
   usuário), User stories numeradas (`Como <ator>, eu quero <feature>, para
   que <benefício>`, cobrindo caminho feliz e erros relevantes), Decisões de
   implementação (módulos/contratos, sem caminho de arquivo nem código),
   Decisões de teste, Fora de escopo.
4. Preencha `plan.md`: abordagem técnica, arquivos/módulos a criar ou mudar
   na ordem de implementação, referenciando código existente a reaproveitar.
5. Preencha `tasks.md`: checklist granular (`- [ ] tarefa`), um item por
   commit plausível.
6. Respeite os ADRs em `docs/adr/` — se a feature contradiz um ADR aceito,
   isso é uma decisão nova: registre-a como um novo ADR em vez de ignorar o
   existente.
7. Confirme com o usuário que os três arquivos batem com o que foi discutido
   antes de considerar pronto pra implementar.
