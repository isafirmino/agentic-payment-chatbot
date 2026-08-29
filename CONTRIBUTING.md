# Contribuindo

Este repo é trabalhado em grupo, com pessoas usando Claude Code e pessoas
usando GitHub Copilot. As regras abaixo valem independente da ferramenta.

## Fluxo de branches

```
main                           — sempre estável. Só recebe merge de develop.
develop                        — integração contínua do time.
feat/<NNN>/<resumo-em-ingles>  — uma feature por branch, nasce de develop.
```

`<NNN>` é o número da task no GitHub Projects do repo — **não** é o número
da pasta do spec (`specs/<NNN>-<slug>/`). Os dois são numerados à parte:
toda feature nova sempre tem um spec (regra do fluxo em `AGENTS.md`), mas o
número da branch segue a task no board, não o spec. `<resumo>` é um resumo
curto em inglês, kebab-case, do que a branch faz. Exemplo: task #42 no
GitHub Projects, spec `specs/003-limite-de-gasto/` → branch
`feat/42/spending-limit`. Como os números não batem, a PR sempre precisa
linkar o spec explicitamente na linha `Spec:` do template — não dá pra
inferir um do outro.

1. Toda feature nova nasce de `develop`:
   `git checkout -b feat/<NNN>/<resumo-em-ingles> develop`, onde `<NNN>` é
   o número da task correspondente no GitHub Projects.
2. Trabalho termina em PR de `feat/<NNN>/<resumo-em-ingles>` para `develop`.
3. `develop` só vai para `main` quando está estável (merge direto, sem
   branch de release por enquanto).
4. Não commite direto em `main` ou `develop`.

`develop` ainda não existe neste repo — crie a partir do primeiro commit em
`main` com `git checkout -b develop`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), mesmo padrão
já usado no repo de workshops de origem:

```
feat: adiciona listar_catalogo na tool MCP
fix: corrige validação de intencao_id expirada
docs: registra ADR sobre provedor de LLM
refactor: extrai validação de limite pra função própria
test: cobre caso de intencao_id de outro usuário
chore: atualiza dependências
```

Um commit, uma intenção. Mensagem no imperativo, sem ponto final.

## Toda feature nova passa por spec → plan → tasks

Antes de escrever código de uma feature (não de um fix pontual), o fluxo é:

1. **Descreva a ideia** em conversa com o agente.
2. **`grill-me`** — entrevista que estressa a ideia até não sobrar nada
   assumido silenciosamente (decisões de design, casos de borda, integração
   com o que já existe).
3. **`to-spec`** — sintetiza a conversa já "grillada" em
   `specs/<NNN>-<slug>/spec.md` + `plan.md` + `tasks.md`. Copie
   `specs/TEMPLATE/` para começar.
4. **Implemente** seguindo o `tasks.md`, marcando os itens conforme completa.
5. **`pr-review`** — antes de abrir o PR, roda a revisão em três frentes:
   conformidade com este documento e com as convenções de código do projeto;
   correção do código (bugs de lógica) e segurança; e fidelidade ao
   `spec.md`/`plan.md`/`tasks.md` da feature.
6. Abra o PR de `feat/<NNN>/<resumo-em-ingles>` para `develop` usando o
   template (`.github/pull_request_template.md`).

Quem usa Claude Code roda esses passos como skills (`.claude/skills/`); quem
usa Copilot usa os prompt files equivalentes em `.github/prompts/`
(`/grill-me`, `/to-spec`, `/pr-review` no Copilot Chat do VS Code).

Fixes pequenos e sem ambiguidade (typo, bug óbvio de uma linha) não
precisam desse fluxo inteiro — vão direto pra um `fix:` numa branch curta.

## Convenções de código

- TypeScript em todo o código de aplicação.
- Sem comentários explicando o óbvio — só quando o porquê não é óbvio pelo
  código (uma decisão não intuitiva, um workaround, uma invariante que não
  aparece na assinatura da função).
- **O modelo nunca decide sozinho se uma compra acontece.** Ele só conversa
  e chama tools; toda validação de intenção, limite de gasto e regra de
  negócio é recalculada e checada no backend antes de qualquer efeito
  colateral real (`realizar_compra`). Isso vale mesmo que o prompt do
  modelo já "garanta" a regra — o backend nunca confia no que o LLM disse.
- Toda tool/regra de negócio nova precisa de teste cobrindo o caminho feliz
  e os casos de erro esperados (siga o padrão de `*.check.ts` já usado no
  `mcp-server`). Lógica de negócio pura (cálculo de limite, validação de
  intenção) ganha teste unitário; contrato entre serviços (payload de tool,
  resposta de auth) ganha teste de integração; o resto pode ficar como
  verificação manual documentada no `spec.md` da feature.
- Erros esperados (limite excedido, intenção inválida/expirada, não
  autenticado) são tratados como retorno de erro explícito, não exceção
  genérica engolida — quem chama (agente, frontend) precisa conseguir
  distinguir o motivo.
- Reaproveite o que já existe nas pastas copiadas (login JWT em
  `api-auth/`, loop de tool-calling em `chat-web/`, servidor MCP em
  `mcp-server/`) em vez de reescrever — elas foram copiadas justamente por
  já resolverem esses pedaços (ver ADR 0001).
- Decisões de arquitetura relevantes viram um ADR em `docs/adr/`
  (`docs/adr/TEMPLATE.md`) — critério completo em `AGENTS.md`.

## Pull Requests

- Título em Conventional Commits.
- Descrição linka o `spec.md`/`plan.md`/`tasks.md` da feature (quando
  houver).
- Pelo menos uma revisão (`pr-review`, humana ou as duas) antes do merge em
  `develop`.
