## Descrição

<!-- O que muda e por quê. Foco no "porquê" — o "o quê" já está no diff. -->

## Tipo de mudança

- [ ] `feat` — nova funcionalidade
- [ ] `fix` — correção de bug
- [ ] `refactor` — mudança que não altera comportamento observável
- [ ] `test` — adiciona ou corrige teste
- [ ] `docs` — documentação
- [ ] `chore` — manutenção (dependências, configuração, etc.)

## Task e spec

<!-- "Closes #N" fecha a issue/task do GitHub Projects automaticamente no
merge; N é o mesmo número usado no nome da branch (feat/<NNN>/<resumo>). -->

Closes #

<!-- Link pra specs/<NNN>-<slug>/spec.md (e plan.md/tasks.md), se esta PR
veio do fluxo grill-me → to-spec. Se não veio (fix pontual), apague esta
linha. -->

Spec:

## Como foi testado

<!-- Testes automatizados adicionados/rodados (comando usado) e/ou passos
de verificação manual, incluindo os casos de erro relevantes. -->

## Checklist

- [ ] Título da PR segue Conventional Commits (`feat:`, `fix:`, `docs:`, ...)
- [ ] Fiz self-review do próprio diff antes de pedir revisão
- [ ] `tasks.md` da feature está com os itens marcados, se houver spec
- [ ] Testes cobrindo caminho feliz e casos de erro relevantes
- [ ] `pr-review` rodado (skill do Claude ou `/pr-review` do Copilot) —
      convenções, correção/segurança, e spec
- [ ] Decisão de arquitetura relevante virou ADR em `docs/adr/`, se aplicável
- [ ] Documentação (`README`, `docs/`) atualizada, se o comportamento mudou
- [ ] Sem segredos/credenciais commitados
