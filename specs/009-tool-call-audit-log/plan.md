# Plano técnico — Log auditável de chamadas de tool

## 1. Schema

- Em `mcp-server/src/schema.ts`, criar `chamadas_tool`:
  `id` (autoincremento), `tool`, `owner_cpf`, `argumentos` (JSON), `resultado`
  (JSON ou resumo), `desfecho` (`aprovado` / `recusado` / código de erro),
  `data` (ISO 8601).
- `CREATE TABLE IF NOT EXISTS` basta: a tabela é nova, não há linhas a migrar —
  ao contrário do `ALTER TABLE` que a task #21 precisou.
- Sem chave estrangeira para `usuarios`: o log precisa sobreviver mesmo que o
  usuário seja removido, e uma chamada pode vir de um CPF que não existe na
  tabela (é justamente um dos casos que se quer auditar).

## 2. Gravação

- Módulo novo `mcp-server/src/audit.ts`, com uma função que recebe tool, CPF,
  argumentos e resultado, e grava. Separado de `tools.ts` porque não é regra de
  negócio.
- A função **captura a própria exceção** e escreve no `console.error`. Nunca
  propaga: quem chama não pode quebrar por causa do log.
- Derivar o `desfecho` do resultado: `status` quando existir, `erro` quando for
  recusa, e um rótulo fixo para o catálogo.
- Resumir o resultado do catálogo — a contagem de produtos — e manter o
  resultado íntegro nas demais.

## 3. Envelope no servidor

- Em `mcp-server/src/server.ts`, criar um helper que embrulha o handler antes de
  passá-lo ao `registerTool`. As três chamadas de `registerTool` passam a usá-lo.
- O envelope roda o handler, grava, e devolve o retorno **sem tocar nele**.
- Ele extrai o objeto de domínio do envelope MCP (`content[0].text`) para
  gravar, mas devolve ao chamador exatamente o que a tool produziu.
- Se o handler lançar, o envelope registra o desfecho como erro e **relança** —
  auditoria não engole exceção.

## 4. Consulta

- `scripts/consultar-chamadas.mjs`, no mesmo estilo do
  `consultar-transacoes.mjs`: reaproveita `resolveDatabasePath`, abre em
  `readOnly`, trata banco e tabela ausentes com mensagem explicativa e
  `process.exitCode`.
- Saída cronológica: instante, tool, CPF, desfecho, e os argumentos resumidos.
- Aceitar filtro opcional por CPF e por tool como argumentos posicionais, já
  que o uso natural é investigar um usuário ou uma tool específica.

## 5. Testes

- `mcp-server/src/audit.check.ts` para a função de gravação, incluindo o caso
  em que o banco falha e a função precisa engolir.
- Acrescentar em `tools.check.ts` o teste que amarra a decisão principal: uma
  compra recusada por `LIMITE_EXCEDIDO` não cria transação **e** deixa linha no
  log.
- Estender o smoke test: depois das chamadas reais, ler a tabela e conferir que
  as chamadas daquele CPF estão lá, com os desfechos esperados.

## 6. Documentação

- ADR 0008: por que fora da transação, por que só o que executa, por que a
  falha de log não derruba a chamada.
- `mcp-server/README.md`: a tabela nova e o que ela cobre.
- `README.md` da raiz: a tabela de conformidade marca o extra de log auditável
  como parcial e aponta para a issue #22 — passa a "cumprido", com o comando de
  consulta ao lado do de transações.

## 7. Verificação

- `npm run check` no `mcp-server`.
- Smoke test com os serviços no ar.
- `node scripts/consultar-chamadas.mjs` sobre o banco da sessão.
- `node scripts/consultar-transacoes.mjs` e `verify-shared-db.mjs`, para
  confirmar que a tabela nova não afetou o que já existia.
