# Tarefas — Log auditável de chamadas de tool

## Schema

- [x] Criar a tabela `chamadas_tool` em `schema.ts`
- [x] Testar que a criação é idempotente e não afeta as tabelas existentes

## Gravação

- [x] Criar `mcp-server/src/audit.ts` com a função de registro
- [x] Derivar o desfecho do resultado (aprovado, código de recusa, catálogo)
- [x] Resumir o resultado do catálogo e manter íntegro o das tools de intenção
- [x] Engolir falha de gravação, escrevendo no `console.error` sem propagar

## Envelope

- [x] Criar o helper que embrulha o handler antes do `registerTool`
- [x] Aplicar às três tools
- [x] Preservar o retorno da tool sem alterá-lo
- [x] Registrar e relançar quando o handler lançar

## Testes

- [x] Chamada bem-sucedida é registrada com tool, CPF, argumentos e resultado
- [x] Chamada recusada é registrada — o caso que distingue esta feature
- [x] Compra recusada por limite: sem transação, **com** linha no log
- [x] Resultado do catálogo resumido, das tools de intenção completo
- [x] Falha de gravação não propaga e o resultado volta intacto
- [x] Smoke test confere, pela camada MCP, que as chamadas aparecem no log

## Consulta

- [x] Criar `scripts/consultar-chamadas.mjs` em modo somente leitura
- [x] Tratar banco ausente, tabela ausente e log vazio com mensagem clara
- [x] Aceitar filtro opcional por CPF e por tool

## Documentação

- [x] ADR 0008 com a decisão e as alternativas descartadas
- [x] `mcp-server/README.md` documenta a tabela e o que ela cobre
- [x] `README.md` da raiz sai de "parcial" para "cumprido" no extra de auditoria

## Verificação

- [x] `npm run check` no `mcp-server`
- [x] Smoke test com os serviços no ar
- [x] `consultar-chamadas.mjs` sobre o banco da sessão
- [x] `consultar-transacoes.mjs` e `verify-shared-db.mjs` seguem passando
- [x] Rodar `pr-review` antes do PR
