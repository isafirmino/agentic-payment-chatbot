---
mode: agent
description: Revisão de PR em três frentes independentes — convenções do repo, correção/segurança do código e fidelidade ao spec/plan/tasks da feature.
---

Revise o diff da branch atual contra `develop` (ou a referência que o
usuário indicar) em três frentes independentes. Não misture as frentes.

## Frente 1 — Convenções

Baseado em `CONTRIBUTING.md`: branch/commit corretos, ADR criado quando a
mudança é uma decisão de arquitetura. Sempre verifique também, mesmo que
não esteja escrito lá:

- Existe teste cobrindo o caminho feliz e os erros esperados de qualquer
  regra de negócio nova ou alterada?
- Nomes obscuros, duplicação óbvia, módulo fazendo coisa demais?

## Frente 2 — Correção e Segurança

Leia o código o suficiente pra julgar se ele faz o que deveria, não só o
diff isolado. Reporte cada achado com o cenário concreto que quebra
(input/estado → resultado errado).

- Bugs de lógica: edge case não tratado, condição invertida, off-by-one,
  estado inconsistente se uma etapa falhar no meio.
- Segurança, com atenção à regra central do projeto (`AGENTS.md`: o modelo
  nunca decide sozinho se uma compra acontece): limite de gasto ou
  validação de intenção confiada ao LLM em vez de recalculada no backend;
  rota sem autenticação exigida; checagem ausente de dono do recurso;
  input usado sem validação/sanitização; segredo/credencial commitado;
  injection, XSS, deserialização insegura, SSRF quando aplicável.

## Frente 3 — Spec

O número da branch (`feat/<NNN>/<resumo-em-ingles>`) é a task do GitHub
Projects, não o número do spec — não dá pra inferir um do outro. Procure a
linha `Spec:` na seção "Task e spec" da descrição do PR; se estiver
vazia/apagada, peça o caminho de `specs/<NNN>-<slug>/` ao usuário. Se não
existir spec associado (mudança pequena que pulou o fluxo, conforme
`CONTRIBUTING.md` permite), diga isso e pule esta frente.

Se existir, confira: os itens relevantes de `tasks.md` foram implementados;
o comportamento implementado bate com `spec.md` (user stories, decisões de
implementação) sem inventar nem deixar de fora nada visível pro usuário.
Divergência do `plan.md` é aceitável (é só um guia); divergência do
`spec.md` precisa ser sinalizada.

## Reportar

Três seções separadas, "Convenções", "Correção e Segurança" e "Spec". Não
funda as listas. Feature sem spec associado: só as duas primeiras, com uma
nota dizendo que "Spec" foi pulada e por quê.
