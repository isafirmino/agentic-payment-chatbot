---
name: pr-review
description: Revisão de PR em três frentes independentes — convenções do repo, correção/segurança do código e fidelidade ao spec/plan/tasks da feature — antes de abrir ou mergear a PR.
---

Revisa as mudanças desde um ponto fixo (branch base, normalmente `develop`,
ou um commit/SHA informado pelo usuário) em três frentes **independentes**.
Não misture as frentes nem deixe uma mascarar problemas da outra.

## 1. Fixar o diff

Confirme a referência (padrão: merge-base com `develop`) e garanta que existe
diff não vazio antes de prosseguir. Se não houver mudanças, diga isso e pare.

## 2. Frente "Convenções"

Fontes: `CONTRIBUTING.md` (branch, commit, quando um ADR é obrigatório) e as
convenções de código descritas lá (TypeScript em tudo, sem comentário
óbvio, teste pra tool/regra de negócio nova).

Além disso, sempre verifique, como baseline fixa:

- **Existem testes** cobrindo o caminho feliz e os erros esperados da lógica
  nova/alterada? Ausência de teste numa regra de negócio nova é sempre
  reportado, mesmo que o `CONTRIBUTING.md` não precise repetir isso.
- **Nomes obscuros**, duplicação óbvia de código, e mistura de
  responsabilidades num mesmo módulo (heurísticas de code smell, não regra
  rígida — julgamento, não checklist automático).

## 3. Frente "Correção e Segurança"

Leia o código de fato (não só o diff isolado) o suficiente pra julgar se ele
faz o que deveria. Reporte cada achado com o cenário concreto que quebra
(input/estado → resultado errado), não só "isso parece arriscado".

Bugs de lógica:

- Edge case não tratado (lista vazia, valor zero/negativo, campo opcional
  ausente), condição invertida, off-by-one, estado que fica inconsistente
  se uma etapa falhar no meio.
- Qualquer coisa que faça o comportamento divergir do que a mudança
  pretende, mesmo sem teste faltando pra expor isso.

Segurança — com atenção especial à regra central do projeto (`AGENTS.md`:
**o modelo nunca decide sozinho se uma compra acontece**):

- Limite de gasto, validação/expiração de intenção, ou qualquer regra de
  negócio sendo confiada ao que o LLM disse (prompt, tool description, ou
  resposta do modelo) em vez de recalculada e checada no backend antes do
  efeito colateral real.
- Rota que deveria exigir autenticação e não exige; checagem ausente de que
  o recurso (ex.: intenção de compra) pertence ao usuário autenticado.
- Entrada do usuário (ou do LLM) usada sem validação/sanitização antes de
  virar query, comando, ou payload pra outro serviço.
- Segredo ou credencial commitado.
- Vulnerabilidades comuns do stack (injection, XSS, deserialização insegura,
  SSRF) quando a mudança tocar em algo exposto a input externo.

## 4. Frente "Spec"

Ache o spec da feature: o número da branch (`feat/<NNN>/<resumo-em-ingles>`)
é a task do GitHub Projects, não o número do spec — não dá pra inferir um
do outro. Procure a linha `Spec:` na seção "Task e spec" da descrição do PR
(preenchida a partir do template); se a PR ainda não existe ou a linha
estiver vazia/apagada, peça o caminho de `specs/<NNN>-<slug>/` ao usuário.
Se a mudança não tem spec associado (fix pontual, conforme `CONTRIBUTING.md`
permite pular o fluxo), diga isso explicitamente e pule esta frente.

Com o spec em mãos, confira:

- Todo item de `tasks.md` relevante à mudança está de fato implementado (ou
  marcado como não feito, sem esconder).
- O código implementa o que `spec.md` descreve como solução e user stories —
  sem inventar comportamento que o spec não previu, sem deixar de fora algo
  que previu.
- Divergências do `plan.md` são aceitáveis (é só um guia), mas divergências
  do `spec.md` (comportamento visível pro usuário) precisam ser sinalizadas.

## 5. Reportar

Três seções separadas, "Convenções", "Correção e Segurança" e "Spec", cada
uma com os achados dessa frente. Não fundir as listas. Feature sem spec
associado: só as duas primeiras seções, com uma nota dizendo que a frente
"Spec" foi pulada e por quê.
