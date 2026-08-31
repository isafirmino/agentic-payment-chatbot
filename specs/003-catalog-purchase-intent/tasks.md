# Tarefas — Catálogo e intenção de compra

## Especificação

- [x] Registrar spec, plano e tarefas da task #7

## Schema e seed

- [ ] Criar tabelas `produtos` e `intencoes` no bootstrap do `mcp-server`
- [ ] Adicionar seed idempotente dos cinco produtos oficiais
- [ ] Adicionar testes do bootstrap e do seed idempotente

## Autenticação

- [ ] Adicionar dependência de JWT ao `mcp-server`
- [ ] Validar Bearer JWT HS256 e extrair o CPF de `sub`
- [ ] Exigir `JWT_SECRET` em produção e documentar o segredo compartilhado
- [ ] Recusar HTTP sem autenticação antes do transporte MCP
- [ ] Cobrir autenticação e configuração do segredo com testes

## Tools MCP

- [ ] Implementar `listarCatalogo` com filtro opcional de categoria
- [ ] Implementar `registrarIntencao` com cálculo backend e validade de cinco minutos
- [ ] Implementar erros estruturados para produto, quantidade e estoque
- [ ] Substituir as tools de workshop por `listar_catalogo` e `registrar_intencao`
- [ ] Cobrir caminhos felizes e erros das tools com testes

## Documentação e verificação

- [ ] Registrar ADR do contrato das tools e dos valores em centavos
- [ ] Atualizar o README do `mcp-server`
- [ ] Rodar `npm run check` no `mcp-server` com cobertura de funções >= 80%
- [ ] Rodar `node scripts/verify-shared-db.mjs`
- [ ] Executar smoke test das duas tools com JWT
- [ ] Rodar `pr-review` antes do PR
- [ ] Realinhar commits em português no padrão do projeto
