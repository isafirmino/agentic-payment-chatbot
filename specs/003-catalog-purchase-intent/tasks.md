# Tarefas — Catálogo e intenção de compra

## Especificação

- [x] Registrar spec, plano e tarefas da task #7

## Schema e seed

- [x] Criar tabelas `produtos` e `intencoes` no bootstrap do `mcp-server`
- [x] Adicionar seed idempotente dos cinco produtos oficiais
- [x] Adicionar testes do bootstrap e do seed idempotente

## Autenticação

- [x] Adicionar dependência de JWT ao `mcp-server`
- [x] Validar Bearer JWT HS256 e extrair o CPF de `sub`
- [x] Exigir `JWT_SECRET` em produção e documentar o segredo compartilhado
- [x] Recusar HTTP sem autenticação antes do transporte MCP
- [x] Cobrir autenticação e configuração do segredo com testes

## Tools MCP

- [x] Implementar `listarCatalogo` com filtro opcional de categoria
- [x] Implementar `registrarIntencao` com cálculo backend e validade de cinco minutos
- [x] Implementar erros estruturados para produto, quantidade e estoque
- [x] Substituir as tools de workshop por `listar_catalogo` e `registrar_intencao`
- [x] Cobrir caminhos felizes e erros das tools com testes

## Documentação e verificação

- [x] Registrar ADR do contrato das tools e dos valores em centavos
- [x] Atualizar o README do `mcp-server`
- [x] Rodar `npm run check` no `mcp-server` com cobertura de funções >= 80%
- [x] Rodar `node scripts/verify-shared-db.mjs`
- [x] Executar smoke test das duas tools com JWT
- [x] Rodar `pr-review` antes do PR
- [x] Realinhar commits em português no padrão do projeto
