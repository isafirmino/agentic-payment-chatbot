# Plano técnico — Catálogo e intenção de compra

## 1. Schema e catálogo

- Criar `mcp-server/src/schema.ts` com `bootstrapSchema(db)` para as tabelas
  `produtos` e `intencoes` usando `CREATE TABLE IF NOT EXISTS`.
- Criar `seedProducts(db)` com os cinco produtos da task #7 usando
  `INSERT OR IGNORE`.
- Reaproveitar `getDb()` de `mcp-server/src/db.ts`; nenhuma conexão SQLite
  adicional deve ser aberta.
- Chamar bootstrap e seed no boot de `mcp-server/src/server.ts`.

## 2. Autenticação MCP

- Criar `mcp-server/src/auth.ts` para validar Bearer JWT com HS256 e extrair o
  CPF de `sub`.
- Centralizar a resolução de `JWT_SECRET`, exigindo configuração explícita
  em produção e permitindo o fallback existente nos demais ambientes.
- Em `mcp-server/src/server.ts`, autenticar antes de
  `transport.handleRequest` e disponibilizar o CPF ao handler de
  `registrar_intencao` sem aceitar identidade enviada nos argumentos da tool.
- Documentar `JWT_SECRET` em `mcp-server/.env.example` como segredo
  compartilhado com `api-auth`.

## 3. Lógica das tools

- Substituir o conteúdo de workshop de `mcp-server/src/tools.ts` por:
  - `listarCatalogo(db, { categoria? })`;
  - `registrarIntencao(db, ownerCpf, { produto_id, quantidade })`;
  - helpers para conversão monetária, ids e retornos recusados.
- Consultar preço e estoque exclusivamente no banco.
- Persistir `valor_total_cents` e converter para `valor_total` apenas na
  resposta.
- Gerar horários ISO 8601 e expiração de cinco minutos. Permitir injetar o
  relógio nos testes se isso mantiver os testes determinísticos sem complicar
  o contrato público.

## 4. Registro MCP

- Remover `get_time` e `list_items` de `mcp-server/src/server.ts`.
- Registrar `listar_catalogo` com `categoria` opcional.
- Registrar `registrar_intencao` com `produto_id` e `quantidade` numérica;
  deixar a regra de inteiro positivo na camada de negócio para produzir
  `QUANTIDADE_INVALIDA` estruturado.
- Manter o formato MCP de conteúdo textual com JSON serializado.

## 5. Testes e documentação

- Criar testes de schema/seed ou incorporá-los a
  `mcp-server/src/tools.check.ts` usando `DatabaseSync(':memory:')`.
- Reescrever `mcp-server/src/tools.check.ts` para o catálogo oficial e todos
  os caminhos definidos na spec.
- Criar `mcp-server/src/auth.check.ts` para o contrato JWT e configuração do
  segredo.
- Atualizar `mcp-server/README.md` com as duas tools, autenticação,
  persistência e exemplos.
- Registrar um ADR para as extensões do contrato das tools, especialmente os
  erros estruturados e o armazenamento monetário em centavos, coordenando a
  numeração com o ADR da task #5 antes do PR.
- Rodar `npm run check` no `mcp-server` e
  `node scripts/verify-shared-db.mjs` na raiz.
- Fazer smoke test via MCP com JWT compatível com a task #5.

## 6. Finalização

- Marcar cada item concluído em `tasks.md`.
- Executar `pr-review` nas frentes de convenções, correção/segurança e
  fidelidade à spec.
- Organizar os commits no padrão Conventional Commits, em português, antes
  de abrir PR de `feat/07/catalog-purchase-intent` para `develop`.
