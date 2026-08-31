# catalog-purchase-intent MCP

Servidor MCP responsável pelo catálogo e pelo registro autenticado de
intenções de compra.

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

`registrar_intencao` consulta preço e estoque no backend. O cliente nunca
envia o valor. Produto inexistente, quantidade inválida e estoque insuficiente
retornam erros estruturados para o agente explicar ao usuário.

Esta task não reserva estoque nem realiza pagamento. Limite de gasto,
decremento de estoque e `realizar_compra` pertencem à task #8.

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
`DATABASE_PATH`. Ele cria e mantém somente:

- `produtos`, com valores monetários em centavos;
- `intencoes`, com produto, quantidade, total, CPF e expiração.

O seed insere os cinco produtos oficiais com `INSERT OR IGNORE`, preservando
estoque e registros existentes. Veja o [ADR 0003](../docs/adr/0003-sqlite-compartilhado-entre-servicos.md)
e o [ADR 0005](../docs/adr/0005-contrato-catalogo-e-intencao.md).

Para verificar que os dois serviços abrem o mesmo banco, na raiz do repo:

```bash
node scripts/verify-shared-db.mjs
```

## Smoke test

Com o `mcp-server` em execução:

```bash
node scripts/smoke-catalog-intention.mjs
```

O script verifica HTTP 401 sem JWT, descoberta das duas tools, filtro de
catálogo, registro de intenção e estoque insuficiente. `MCP_URL` e
`JWT_SECRET` podem sobrescrever os valores padrão.
