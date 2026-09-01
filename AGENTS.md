# Instruções para agentes

Este repo é trabalhado por várias pessoas, algumas com Claude Code, outras
com GitHub Copilot. Estas instruções valem pra qualquer agente, independente
da ferramenta.

## O que é este projeto

Desafio da trilha de Pagamentos Agênticos: um chatbot que conversa com um
LLM e executa compras simuladas via 3 tools MCP (`listar_catalogo`,
`registrar_intencao`, `realizar_compra`), atrás de login, com limite de
gasto e validação de intenção sempre feitas no backend — **o modelo nunca é
confiável pra decidir se uma compra pode acontecer**, só pra conversar e
chamar as tools; quem decide é sempre o backend. Enunciado completo em
`docs/desafio.md`.

Fluxo em alto nível (detalhado em `docs/architecture.md`):

```
Frontend (chat) → Backend (auth + agente + MCP client) → Servidor MCP (3 tools)
```

- `chat-web/` — frontend de chat.
- `api-auth/` — backend de autenticação (login JWT + scrypt).
- `mcp-server/` — servidor MCP com as tools, via Streamable HTTP.

Todo o código de aplicação é TypeScript.

Estado atual: essas três pastas são cópias diretas de projetos de workshop
anteriores (ver `docs/adr/0001-base-a-partir-dos-workshops.md`) — ainda não
implementam nada específico do desafio. Faltam, entre outras coisas: as 3
tools do contrato (`mcp-server` hoje tem tools de exemplo), catálogo de
produtos, registro e validação de intenção, limite de gasto, integração do
chat com o login, e a escolha de provedor de LLM (nenhum decidido ainda —
`chat-web` hoje fala com Ollama, herdado do workshop). Nada disso deve ser
pré-implementado fora do fluxo de feature abaixo; decisão de produto ou
arquitetura que apareça no caminho vira pergunta pro usuário ou ADR, não
suposição.

## Fluxo obrigatório pra features novas

Não pule direto pra código numa feature nova (fix pontual de uma linha pode
pular). A ordem é:

1. Conversa com o usuário pra entender a ideia.
2. **`grill-me`** — entrevista que estressa o plano até não sobrar nada
   assumido silenciosamente. Claude: skill `grill-me`. Copilot:
   `/grill-me` (`.github/prompts/grill-me.prompt.md`).
3. **`to-spec`** — sintetiza a conversa já grillada em
   `specs/<NNN>-<slug>/{spec.md,plan.md,tasks.md}` (copie
   `specs/TEMPLATE/`) se for feature nova, ou em uma emenda à spec
   existente se o `grill-me` identificou que não é ("## Emenda" em
   `spec.md`, sem pasta nova). Claude chama isso automaticamente assim que
   o `grilling` termina (fronteira vazia) e o usuário confirma entendimento
   compartilhado — não precisa esperar o usuário digitar `/to-spec`.
   Copilot: usuário digita `/to-spec` (sem invocação automática).
4. Implementar seguindo `tasks.md`, numa branch `feat/<NNN>/<resumo-em-ingles>`
   (`NNN` é o número da task no GitHub Projects do repo, não o número do
   spec — os dois são numerados à parte) criada a partir de `develop`,
   marcando cada item (`- [x]`) conforme completa. Antes de seguir pro
   próximo passo, confira que todo item de `tasks.md` está marcado — item
   não feito significa feature incompleta, não "deixa pro próximo PR" sem
   avisar o usuário.
5. **`pr-review`** antes do PR — três frentes: convenções do repo
   (`CONTRIBUTING.md`), correção/segurança do código, e fidelidade ao
   spec/plan/tasks da feature. Claude: skill `pr-review`. Copilot:
   `/pr-review`.
6. PR de `feat/<NNN>/<resumo-em-ingles>` para `develop`, usando
   `.github/pull_request_template.md`.

Detalhes de branch, commit e convenções de código: `CONTRIBUTING.md`.

## Quando abrir um ADR

Um ADR (`docs/adr/<NNN>-<slug>.md`, copiando `docs/adr/TEMPLATE.md`)
registra uma decisão e o porquê dela, pra quem chegar depois não precisar
adivinhar. Abra um quando a decisão:

- Muda o contrato entre serviços (payload de uma tool MCP, formato de
  resposta da API de auth, schema de dado compartilhado).
- Introduz ou troca uma dependência externa (biblioteca relevante, provedor
  de LLM, qualquer serviço simulado de pagamento).
- Define uma regra de negócio difícil de reverter depois (política de
  limite de gasto, forma de validar/expirar uma intenção de compra).
- Escolhe entre duas abordagens técnicas concorrentes quando a escolha não
  é óbvia só de olhar o código (exemplo: por que copiar os workshops em vez
  de escrever do zero — `docs/adr/0001-base-a-partir-dos-workshops.md`).

Não precisa de ADR: fix de bug, refactor que não muda contrato nem
comportamento observável, ou detalhe de implementação contido num único
módulo. Na dúvida, é mais barato escrever o ADR do que perder o porquê de
uma decisão daqui a duas semanas.

## Regras que valem sempre

- Decisões de arquitetura viram ADR (critério acima) — nunca fique só na
  conversa.
- Tool ou regra de negócio nova vem com teste do caminho feliz e dos erros
  esperados, cobrindo no mínimo 80% das funções do módulo. Teste roda via
  `node --test` (test runner nativo do Node, sem framework externo — ver
  convenção em `CONTRIBUTING.md`); o `check` de cada pacote falha se a
  cobertura de funções ficar abaixo de 80%
  (`--test-coverage-functions=80`).
- Antes de considerar qualquer tarefa de código finalizada, rode `npm run
  check` (ou equivalente) em todo pacote alterado — não só nos arquivos
  novos — e garanta que passa, testes e cobertura incluídos.
- Nunca invente decisão de produto (preço, limite, regra de negócio) sem
  perguntar — isso é exatamente o que o `grill-me` existe pra evitar.
- Validação de intenção e de limite de gasto nunca confia no que o modelo
  disse — é sempre recalculada/checada no backend antes de `realizar_compra`
  executar algo.
