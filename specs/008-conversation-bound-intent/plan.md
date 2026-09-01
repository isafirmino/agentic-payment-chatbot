# Plano técnico — Intenção vinculada à conversa

## 1. Schema

- Em `mcp-server/src/schema.ts`, acrescentar `conversa_id TEXT` à criação de
  `intencoes` (para bancos novos) **e** um `ALTER TABLE` idempotente para
  bancos que já existem — `CREATE TABLE IF NOT EXISTS` não altera tabela já
  criada, então o `ALTER` é o que faz a migração acontecer.
- Descobrir se a coluna já existe com `PRAGMA table_info(intencoes)` em vez de
  tentar o `ALTER` e engolir o erro: engolir esconderia uma falha diferente.
- Coluna **anulável**, deliberadamente. Ver `spec.md`.

## 2. Identidade de conversa no servidor MCP

- Em `mcp-server/src/auth.ts`, acrescentar a validação do identificador:
  formato UUID v4, com uma função exportada e testável, no mesmo estilo do
  `resolveCpf` que já vive lá.
- Em `mcp-server/src/server.ts`, estender o `AsyncLocalStorage` de
  `{ cpf }` para `{ cpf, conversaId }`. O `conversaId` é opcional no contexto:
  o catálogo funciona sem ele.
- Ler o cabeçalho no handler de `/mcp`, junto de onde o CPF já é resolvido do
  `Authorization`.
- Criar um `currentConversaId()` que **lança** quando não há identificador, do
  mesmo jeito que `currentCpf()` já lança sem contexto. As duas tools de
  intenção o chamam; o catálogo não.

## 3. Regra nas tools

- `registrarIntencao` em `mcp-server/src/tools.ts` passa a receber o
  `conversaId` e gravá-lo no `INSERT`.
- `realizarCompra` passa a receber o `conversaId` e a incluí-lo no `WHERE` da
  consulta que já filtra `id` e `owner_cpf`. Uma linha a mais na mesma
  condição, não uma checagem separada depois — assim não há janela entre
  validar e usar.
- Como `conversa_id` é anulável e SQL compara `NULL` como desconhecido, a
  condição precisa ser de igualdade simples: linha com `NULL` nunca casa, que é
  exatamente o comportamento desejado para intenções anteriores à migração.
- Nenhum retorno de tool passa a expor o identificador de conversa.

## 4. Frontend

- Em `chat-web/src/app/page.tsx`, gerar o identificador uma vez, no mount, com
  `crypto.randomUUID()`, guardado num `useRef` — não deve mudar entre
  renderizações nem sobreviver a reload.
- Enviá-lo no corpo do `POST /api/chat`, ao lado de `messages`.
- Em `chat-web/src/app/api/chat/route.ts`, validar a presença no corpo e
  repassar no `requestInit.headers` do transporte MCP, ao lado do
  `Authorization` que já vai ali. A rota já cria um cliente por requisição,
  então não há estado compartilhado a acertar.

## 5. Scripts do repositório

- `mcp-server/scripts/smoke-catalog-intention.mjs` e
  `scripts/verificar-recusas.mjs` passam a gerar um identificador e enviá-lo,
  como qualquer cliente faria.
- Aproveitar o smoke test para cobrir, na camada MCP, o que os testes de
  unidade não alcançam: chamada de intenção **sem** o cabeçalho é recusada, e
  `listar_catalogo` continua funcionando sem ele.
- Conferir se `mcp-server/src/purchase-concurrency-worker.ts` fala com o MCP ou
  direto com o banco; se for direto, não precisa de mudança.

## 6. Documentação

- ADR 0007 registrando a decisão: por que cabeçalho e não argumento, por que
  coluna anulável, por que `INTENCAO_INVALIDA` em vez de código novo.
- `mcp-server/README.md`: documentar o cabeçalho exigido e em quais tools.
- Emenda curta em `specs/006-purchase-payment/spec.md` apontando que o item
  "Fora de escopo" sobre vínculo com sessão foi resolvido aqui, para quem ler
  aquela spec não concluir que a lacuna continua aberta.

## 7. Verificação

- `npm run check` no `mcp-server` e no `chat-web`.
- Smoke test com os três serviços no ar.
- `node scripts/verify-shared-db.mjs` e `node scripts/verificar-recusas.mjs`.
- Manual: registrar intenção, recarregar a página, confirmar que o pagamento é
  recusado — e que registrar de novo funciona.
