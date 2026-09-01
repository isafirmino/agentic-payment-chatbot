# Tarefas — Confirmação e pagamento da compra

## Especificação

- [x] Registrar spec, plano e tarefas da task #8
- [x] Registrar ADR da atomicidade, limite acumulado e defesa contra duplicidade

## Schema

- [x] Criar a tabela `transacoes` no bootstrap do `mcp-server`
- [x] Cobrir criação idempotente, foreign key e unicidade do schema

## Tool MCP

- [x] Implementar `realizarCompra` com as validações na ordem contratada
- [x] Calcular limite acumulado exclusivamente no backend e em centavos
- [x] Tornar inserção, estoque e status atômicos com `BEGIN IMMEDIATE`
- [x] Traduzir duplicidade de `intencao_id` para `INTENCAO_JA_PAGA`
- [x] Registrar `realizar_compra` no servidor MCP

## Testes

- [x] Cobrir aprovação por cartão e pix e todos os efeitos persistidos
- [x] Cobrir `INTENCAO_INVALIDA` para id alheio, inexistente e CPF inexistente
- [x] Cobrir `INTENCAO_JA_PAGA`, `INTENCAO_EXPIRADA`, `METODO_INVALIDO` e `LIMITE_EXCEDIDO`
- [x] Cobrir prioridade das validações, limites exatos e fronteira da expiração
- [x] Cobrir rollback e tradução da restrição única
- [x] Cobrir duas compras concorrentes da mesma intenção

## Documentação e verificação

- [x] Atualizar o README do `mcp-server` com a terceira tool e a persistência
- [x] Estender o smoke test MCP para uma compra autenticada
- [x] Rodar `npm run check` no `mcp-server` com cobertura de funções >= 80%
- [x] Rodar `node scripts/verify-shared-db.mjs`
- [x] Executar smoke test da compra com JWT
- [x] Rodar `pr-review` antes do PR
