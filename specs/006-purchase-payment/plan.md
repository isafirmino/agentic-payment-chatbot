# Plano técnico — Confirmação e pagamento da compra

## 1. Schema de transações

- Estender `mcp-server/src/schema.ts` para que `bootstrapSchema(db)` também
  crie `transacoes` com valores monetários em centavos,
  `UNIQUE(intencao_id)`, referência para `intencoes` e os campos definidos na
  spec.
- Atualizar `mcp-server/src/schema.check.ts` para conferir o novo schema, sua
  idempotência, integridade referencial e unicidade.
- Reaproveitar exclusivamente a conexão de `mcp-server/src/db.ts`, que já
  habilita foreign keys, WAL e espera por locks.

## 2. Regra de negócio da compra

- Estender `mcp-server/src/tools.ts` com os tipos de sucesso e recusa de
  compra, geração de `tx_<random>` e `realizarCompra(db, ownerCpf, args, now)`.
- Iniciar a operação com `BEGIN IMMEDIATE` e garantir `COMMIT` no sucesso e
  `ROLLBACK` em toda recusa ou exceção.
- Consultar a intenção e o usuário no banco e aplicar a ordem de validação da
  spec. Comparar e somar somente inteiros em centavos.
- Calcular o limite restante com `usuarios.limite_cents` menos a soma de
  `transacoes.valor_cents` do CPF. Retornar o saldo depois da compra.
- Depois das cinco validações contratuais, consultar o estoque atual ainda sob
  `BEGIN IMMEDIATE`. Se não houver unidades, marcar a intenção como
  `cancelada_estoque`, confirmar somente essa mudança e retornar
  `INTENCAO_INVALIDA` com orientação para registrar uma nova intenção.
- Inserir a transação antes de atualizar estoque e intenção, mantendo os três
  efeitos na mesma transação SQL.
- Reconhecer especificamente a violação de unicidade de
  `transacoes.intencao_id`, reverter a operação e traduzi-la para
  `INTENCAO_JA_PAGA`; outras falhas técnicas continuam sendo propagadas depois
  do rollback.

## 3. Registro da tool MCP

- Atualizar `mcp-server/src/server.ts` para importar e registrar
  `realizar_compra` ao lado das duas tools existentes.
- Declarar `intencao_id` e `metodo_pagamento` como strings no schema público,
  deixando a validação dos valores aceitos na regra de negócio para produzir
  `METODO_INVALIDO` estruturado.
- Reaproveitar `currentCpf()`, `getDb()` e o helper que serializa respostas em
  conteúdo textual MCP.

## 4. Testes da tool

- Expandir `mcp-server/src/tools.check.ts` com uma tabela `usuarios` mínima e
  helpers para criar intenções determinísticas.
- Cobrir aprovações com cartão e pix, persistência da transação, decremento de
  estoque, mudança de status, saldo acumulado e conversões na resposta.
- Cobrir, na ordem contratada, intenção inexistente ou alheia, CPF inexistente,
  intenção já paga, intenção expirada, método inválido e limite excedido.
- Cobrir o limite exato e o instante exato de expiração como caminhos aceitos.
- Forçar uma colisão de `intencao_id` com estado inconsistente controlado para
  testar rollback e tradução da restrição única.
- Criar um teste concorrente sobre arquivo SQLite temporário e duas conexões
  independentes, exigindo uma aprovação e uma `INTENCAO_JA_PAGA`. Aplicar o
  mesmo `busy_timeout` da aplicação à conexão final de verificação.
- Cobrir duas intenções sequenciais para todo o estoque de um produto: a
  primeira aprova, a segunda retorna `INTENCAO_INVALIDA`, não cria transação e
  permanece cancelada nas tentativas seguintes.

## 5. Documentação e verificação

- Registrar em `docs/adr/0006-compra-atomica-e-limite-acumulado.md` a política
  de limite acumulado, a serialização com `BEGIN IMMEDIATE` e a unicidade por
  intenção.
- Atualizar `mcp-server/README.md` com a terceira tool, tabela de transações,
  validações, métodos e exemplos de retorno.
- Estender o smoke test MCP para preparar um usuário, registrar uma intenção e
  realizar uma compra autenticada.
- Rodar `npm run check` no `mcp-server` e
  `node scripts/verify-shared-db.mjs` na raiz.

## 6. Finalização

- Marcar cada item concluído em `tasks.md` antes de considerar a feature
  pronta.
- Executar `pr-review` nas frentes de convenções, correção/segurança e
  fidelidade à spec.
- Preparar a PR de `feat/08/purchase-payment` para `develop` usando o template
  do repositório e apontando para `specs/006-purchase-payment/`.
