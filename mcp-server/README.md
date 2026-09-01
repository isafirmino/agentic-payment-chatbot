# agentic-payment MCP

Servidor MCP responsável pelo catálogo, pelas intenções autenticadas e pela
confirmação de compras simuladas.

```bash
npm install
npm start
npm run check
```

O endpoint Streamable HTTP é `POST http://localhost:4000/mcp`.

## Tools

| Tool | Argumentos | Resultado |
| --- | --- | --- |
| `listar_catalogo` | `categoria?: string` | Produtos com id, nome, preço em reais, moeda e estoque. |
| `registrar_intencao` | `produto_id: string`, `quantidade: number` | Intenção pendente, associada ao CPF autenticado e válida por cinco minutos. |
| `realizar_compra` | `intencao_id: string`, `metodo_pagamento: string` | Aprova ou recusa o pagamento da intenção autenticada. |

`registrar_intencao` consulta preço e estoque no backend. O cliente nunca
envia o valor. Produto inexistente, quantidade inválida e estoque insuficiente
retornam erros estruturados para o agente explicar ao usuário.

`realizar_compra` aceita somente `cartao` e `pix`, na grafia exata. O backend
busca a intenção e o limite pelo CPF do JWT, sem aceitar identidade, valor ou
quantidade enviados pelo modelo. As validações ocorrem nesta ordem:

1. intenção existente, pertencente ao CPF e usuário ainda existente;
2. intenção pendente;
3. intenção não expirada;
4. método de pagamento válido;
5. valor dentro do limite restante.

Recusas retornam `INTENCAO_INVALIDA`, `INTENCAO_JA_PAGA`,
`INTENCAO_EXPIRADA`, `METODO_INVALIDO` ou `LIMITE_EXCEDIDO`, sempre com uma
mensagem legível para o agente. Uma aprovação retorna o valor e o limite
restante em reais, mas todos os cálculos e valores persistidos usam centavos.

## Autenticação

Toda chamada exige:

```http
Authorization: Bearer <jwt>
```

O token é validado com HS256 e o CPF vem de `sub`, conforme o contrato do
`api-auth`. O `JWT_SECRET` precisa ser igual nos dois serviços. Em produção,
o `mcp-server` não inicia sem essa variável; em desenvolvimento, usa o segredo
de workshop como fallback.

## Persistência

O serviço reaproveita o SQLite compartilhado da task #6, configurado por
`DATABASE_PATH`. Ele cria e mantém:

- `produtos`, com valores monetários em centavos;
- `intencoes`, com produto, quantidade, total, CPF e expiração;
- `transacoes`, com uma compra aprovada por `intencao_id` e os dados usados no
  cálculo acumulado do limite.

O seed insere os cinco produtos oficiais com `INSERT OR IGNORE`, preservando
estoque e registros existentes. Inserção da transação, decremento do estoque e
mudança da intenção para `paga` acontecem sob uma única transação
`BEGIN IMMEDIATE`. `UNIQUE(intencao_id)` fornece uma defesa adicional contra
cobrança duplicada. Veja o
[ADR 0003](../docs/adr/0003-sqlite-compartilhado-entre-servicos.md), o
[ADR 0005](../docs/adr/0005-contrato-catalogo-e-intencao.md) e o
[ADR 0006](../docs/adr/0006-compra-atomica-e-limite-acumulado.md).

Para verificar que os dois serviços abrem o mesmo banco, na raiz do repo:

```bash
node scripts/verify-shared-db.mjs
```

## Smoke test

Com o `mcp-server` em execução:

```bash
node scripts/smoke-catalog-intention.mjs
```

O script prepara um usuário isolado no banco compartilhado e verifica HTTP 401
sem JWT, descoberta das três tools, filtro de catálogo, registro de intenção,
estoque insuficiente e compra aprovada por pix. `MCP_URL`, `JWT_SECRET` e
`DATABASE_PATH` podem sobrescrever os valores padrão.
