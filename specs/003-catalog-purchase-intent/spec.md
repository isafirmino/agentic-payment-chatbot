# 003 — Catálogo e intenção de compra

## Problema

O agente ainda enxerga apenas as tools de exemplo do workshop e não possui
um catálogo persistente nem uma forma segura de registrar o produto, a
quantidade e o preço escolhidos pelo usuário antes da confirmação do
pagamento.

Sem uma intenção criada pelo backend, etapas posteriores poderiam confiar
em preços ou quantidades inventados pelo modelo. Também não haveria um
registro associado ao CPF autenticado para a futura validação da compra.

## Solução

Disponibilizar no servidor MCP um catálogo persistente e duas tools:
`listar_catalogo`, para consultar os produtos disponíveis, e
`registrar_intencao`, para registrar por cinco minutos a escolha do usuário.
O backend consulta o produto no banco, valida quantidade e estoque, calcula o
valor total em centavos e associa a intenção ao CPF do JWT.

## User stories

1. Como usuário autenticado, eu quero listar os produtos disponíveis, para
   que eu possa escolher o que comprar.
2. Como usuário autenticado, eu quero filtrar o catálogo por categoria, para
   que eu encontre produtos relevantes com facilidade.
3. Como usuário autenticado, eu quero registrar uma intenção com produto e
   quantidade, para que preço, quantidade e propriedade fiquem registrados
   antes da confirmação do pagamento.
4. Como usuário, eu quero receber um erro compreensível quando o produto não
   existir, a quantidade for inválida ou o estoque for insuficiente, para que
   o agente consiga explicar por que a intenção foi recusada.
5. Como backend, eu quero calcular o valor da intenção usando o preço salvo
   no catálogo, para que o modelo não consiga escolher ou alterar o valor.
6. Como backend, eu quero recusar chamadas sem JWT válido antes de executar
   uma tool, para que toda intenção tenha um proprietário autenticado.

## Decisões de implementação

- O `mcp-server` usa a conexão SQLite compartilhada definida na spec 002 e é
  dono das tabelas `produtos` e `intencoes`.
- `produtos` possui `id`, `nome`, `preco_cents`, `moeda`, `estoque` e
  `categoria`. `intencoes` possui `id`, `produto_id`, `quantidade`,
  `valor_total_cents`, `status`, `owner_cpf`, `criada_em` e `expira_em`.
- Valores monetários são armazenados como inteiros em centavos e convertidos
  para reais somente nos retornos das tools.
- O catálogo inicial contém exatamente os cinco produtos definidos na task
  #7. O seed usa inserção idempotente e não sobrescreve produtos existentes.
- O filtro de categoria remove espaços externos e não diferencia maiúsculas
  de minúsculas. Categoria inexistente retorna `{ produtos: [] }`.
- `listar_catalogo` retorna somente `id`, `nome`, `preco`, `moeda` e
  `estoque`; categoria é apenas um filtro.
- `registrar_intencao` recebe somente `produto_id` e `quantidade`. O backend
  valida produto existente, quantidade inteira positiva e estoque suficiente.
- Erros esperados retornam `status: "recusado"`, um dos códigos
  `PRODUTO_INEXISTENTE`, `QUANTIDADE_INVALIDA` ou `ESTOQUE_INSUFICIENTE`, e
  uma mensagem legível.
- O valor total é `preco_cents × quantidade`. A resposta o converte para
  reais e inclui `valido_por_minutos: 5`.
- Intenções usam ids `int_<random>`, ficam com status `pendente` e expiram
  cinco minutos depois da criação.
- Registrar uma intenção verifica o estoque, mas não reserva nem decrementa
  unidades. A movimentação pertence à task #8.
- Todas as chamadas a `/mcp` exigem JWT HS256 válido. O CPF vem do claim
  padrão `sub`, conforme o contrato fechado da task #5.
- O segredo JWT é compartilhado pelos serviços. Em produção, a ausência
  de `JWT_SECRET` impede o boot; fora de produção, o segredo de workshop pode
  ser usado como fallback.
- Requisições sem autenticação válida recebem HTTP 401 com
  `{ "error": "unauthorized" }` antes do transporte MCP.
- `owner_cpf` não possui foreign key para `usuarios`: a task #7 pode iniciar
  independentemente da implementação da task #5 e confia na assinatura do
  token para autenticar o CPF.
- As tools de exemplo `get_time` e `list_items` deixam de ser expostas.

## Decisões de teste

- Testes unitários com SQLite em memória cobrem bootstrap e seed
  idempotentes, catálogo completo, filtro de categoria e categoria sem
  resultados.
- `registrar_intencao` cobre caminho feliz, cálculo em centavos, propriedade,
  validade de cinco minutos, produto inexistente, quantidade inválida e
  estoque insuficiente.
- Autenticação cobre JWT válido, token ausente, assinatura inválida, `sub`
  ausente e exigência de segredo em produção.
- O `check` do `mcp-server` deve passar com no mínimo 80% de cobertura de
  funções e sem erros de TypeScript.
- Uma verificação manual ou smoke test confirma descoberta e chamada das
  duas tools por Streamable HTTP com JWT.

## Fora de escopo

- Cadastro, login, gate do chat e propagação do JWT, pertencentes à task #5.
- Limite de gasto, tabela de transações e `realizar_compra`, pertencentes à
  task #8.
- Reserva ou decremento de estoque durante o registro da intenção.
- Validação de formato do CPF.
- Suporte a moedas diferentes de BRL.
