import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

export const INTENTION_VALIDITY_MINUTES = 5

export type Rejected = {
  status: 'recusado'
  erro: 'PRODUTO_INEXISTENTE' | 'QUANTIDADE_INVALIDA' | 'ESTOQUE_INSUFICIENTE'
  mensagem: string
}
type ProductRow = { id: string; nome: string; preco_cents: number; moeda: string; estoque: number }

function rejected(erro: Rejected['erro'], mensagem: string): Rejected {
  return { status: 'recusado', erro, mensagem }
}

export function generateIntentionId(): string {
  return `int_${randomBytes(3).toString('hex')}`
}

export function listarCatalogo(db: DatabaseSync, args: { categoria?: unknown }) {
  const categoria = typeof args.categoria === 'string' ? args.categoria.trim() : ''
  const query = categoria
    ? `SELECT id, nome, preco_cents, moeda, estoque FROM produtos
       WHERE lower(categoria) = lower(?) ORDER BY id`
    : `SELECT id, nome, preco_cents, moeda, estoque FROM produtos ORDER BY id`
  const rows = (categoria ? db.prepare(query).all(categoria) : db.prepare(query).all()) as ProductRow[]

  return {
    produtos: rows.map(({ preco_cents, ...product }) => ({ ...product, preco: preco_cents / 100 })),
  }
}

export function registrarIntencao(
  db: DatabaseSync,
  ownerCpf: string,
  args: { produto_id?: unknown; quantidade?: unknown },
  now = new Date(),
) {
  const productId = typeof args.produto_id === 'string' ? args.produto_id.trim() : ''
  if (!productId) return rejected('PRODUTO_INEXISTENTE', 'Produto não encontrado no catálogo.')

  const quantity = args.quantidade
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    return rejected('QUANTIDADE_INVALIDA', 'Quantidade deve ser um inteiro maior que zero.')
  }

  const product = db.prepare(`SELECT id, preco_cents, moeda, estoque FROM produtos WHERE id = ?`).get(productId) as
    | Pick<ProductRow, 'id' | 'preco_cents' | 'moeda' | 'estoque'>
    | undefined
  if (!product) return rejected('PRODUTO_INEXISTENTE', 'Produto não encontrado no catálogo.')
  if (quantity > product.estoque) {
    return rejected('ESTOQUE_INSUFICIENTE', 'Estoque insuficiente para a quantidade solicitada.')
  }

  const intentionId = generateIntentionId()
  const totalCents = product.preco_cents * quantity
  const createdAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + INTENTION_VALIDITY_MINUTES * 60_000).toISOString()

  db.prepare(
    `INSERT INTO intencoes
      (id, produto_id, quantidade, valor_total_cents, status, owner_cpf, criada_em, expira_em)
     VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?)`,
  ).run(intentionId, product.id, quantity, totalCents, ownerCpf, createdAt, expiresAt)

  return {
    intencao_id: intentionId,
    produto_id: product.id,
    quantidade: quantity,
    valor_total: totalCents / 100,
    moeda: product.moeda,
    status: 'pendente' as const,
    expira_em: expiresAt,
    valido_por_minutos: INTENTION_VALIDITY_MINUTES,
  }
}
