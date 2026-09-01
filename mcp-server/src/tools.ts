import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

export const INTENTION_VALIDITY_MINUTES = 5

export type Rejected = {
  status: 'recusado'
  erro: 'PRODUTO_INEXISTENTE' | 'QUANTIDADE_INVALIDA' | 'ESTOQUE_INSUFICIENTE'
  mensagem: string
}
export type PurchaseRejected = {
  status: 'recusado'
  erro: 'INTENCAO_INVALIDA' | 'INTENCAO_EXPIRADA' | 'INTENCAO_JA_PAGA' | 'LIMITE_EXCEDIDO' | 'METODO_INVALIDO'
  mensagem: string
}
type ProductRow = { id: string; nome: string; preco_cents: number; moeda: string; estoque: number }
type IntentionRow = {
  id: string
  produto_id: string
  quantidade: number
  valor_total_cents: number
  status: string
  expira_em: string
}
type UserLimitRow = { limite_cents: number }
type TotalSpentRow = { total_cents: number }
type StockRow = { estoque: number }

const STOCK_UNAVAILABLE_STATUS = 'cancelada_estoque'

function rejected(erro: Rejected['erro'], mensagem: string): Rejected {
  return { status: 'recusado', erro, mensagem }
}

function purchaseRejected(erro: PurchaseRejected['erro'], mensagem: string): PurchaseRejected {
  return { status: 'recusado', erro, mensagem }
}

function isDuplicateIntention(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed: transacoes.intencao_id')
}

export function generateIntentionId(): string {
  return `int_${randomBytes(3).toString('hex')}`
}

export function generateTransactionId(): string {
  return `tx_${randomBytes(8).toString('hex')}`
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
  conversaId: string,
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
      (id, produto_id, quantidade, valor_total_cents, status, owner_cpf, conversa_id, criada_em, expira_em)
     VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?, ?)`,
  ).run(intentionId, product.id, quantity, totalCents, ownerCpf, conversaId, createdAt, expiresAt)

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

export function realizarCompra(
  db: DatabaseSync,
  ownerCpf: string,
  conversaId: string,
  args: { intencao_id?: unknown; metodo_pagamento?: unknown },
  now = new Date(),
) {
  let transactionOpen = false

  const refuse = (erro: PurchaseRejected['erro'], mensagem: string): PurchaseRejected => {
    db.exec('ROLLBACK')
    transactionOpen = false
    return purchaseRejected(erro, mensagem)
  }

  try {
    db.exec('BEGIN IMMEDIATE')
    transactionOpen = true

    const intentionId = typeof args.intencao_id === 'string' ? args.intencao_id : ''
    // conversa_id entra na MESMA condição de id e owner_cpf, não numa checagem
    // depois: assim não existe janela entre validar e usar. Intenção anterior
    // ao ADR 0007 tem conversa_id NULL, e NULL nunca casa numa igualdade — ela
    // deixa de ser pagável por consequência da regra, sem precisar ser apagada.
    const intention = db.prepare(
      `SELECT id, produto_id, quantidade, valor_total_cents, status, expira_em
       FROM intencoes WHERE id = ? AND owner_cpf = ? AND conversa_id = ?`,
    ).get(intentionId, ownerCpf, conversaId) as IntentionRow | undefined
    const user = db.prepare(`SELECT limite_cents FROM usuarios WHERE cpf = ?`).get(ownerCpf) as
      | UserLimitRow
      | undefined

    if (!intention || !user) {
      return refuse('INTENCAO_INVALIDA', 'Intenção inválida para o usuário autenticado.')
    }
    if (intention.status === STOCK_UNAVAILABLE_STATUS) {
      return refuse('INTENCAO_INVALIDA', 'O estoque desta intenção não está mais disponível. Registre uma nova intenção.')
    }
    if (intention.status !== 'pendente') {
      return refuse('INTENCAO_JA_PAGA', 'Esta intenção de compra já foi utilizada.')
    }
    const expiresAt = new Date(intention.expira_em).getTime()
    if (!Number.isFinite(expiresAt) || now.getTime() > expiresAt) {
      return refuse('INTENCAO_EXPIRADA', 'Esta intenção de compra expirou. Registre uma nova intenção.')
    }

    const paymentMethod = args.metodo_pagamento
    if (paymentMethod !== 'cartao' && paymentMethod !== 'pix') {
      return refuse('METODO_INVALIDO', 'Método de pagamento inválido. Escolha cartao ou pix.')
    }

    const { total_cents: totalSpentCents } = db.prepare(
      `SELECT COALESCE(SUM(valor_cents), 0) AS total_cents
       FROM transacoes WHERE owner_cpf = ?`,
    ).get(ownerCpf) as TotalSpentRow
    const remainingBeforePurchaseCents = user.limite_cents - totalSpentCents
    if (intention.valor_total_cents > remainingBeforePurchaseCents) {
      return refuse('LIMITE_EXCEDIDO', 'O valor da compra excede o limite restante.')
    }

    const product = db.prepare(`SELECT estoque FROM produtos WHERE id = ?`).get(intention.produto_id) as
      | StockRow
      | undefined
    if (!product || product.estoque < intention.quantidade) {
      db.prepare(`UPDATE intencoes SET status = ? WHERE id = ?`).run(STOCK_UNAVAILABLE_STATUS, intention.id)
      db.exec('COMMIT')
      transactionOpen = false
      return purchaseRejected(
        'INTENCAO_INVALIDA',
        'O estoque desta intenção não está mais disponível. Registre uma nova intenção.',
      )
    }

    const transactionId = generateTransactionId()
    const transactionDate = now.toISOString()
    db.prepare(
      `INSERT INTO transacoes
        (id, intencao_id, valor_cents, metodo_pagamento, owner_cpf, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      transactionId,
      intention.id,
      intention.valor_total_cents,
      paymentMethod,
      ownerCpf,
      transactionDate,
    )
    db.prepare(`UPDATE produtos SET estoque = estoque - ? WHERE id = ?`).run(
      intention.quantidade,
      intention.produto_id,
    )
    db.prepare(`UPDATE intencoes SET status = 'paga' WHERE id = ?`).run(intention.id)

    db.exec('COMMIT')
    transactionOpen = false

    return {
      status: 'aprovado' as const,
      transacao_id: transactionId,
      intencao_id: intention.id,
      valor: intention.valor_total_cents / 100,
      metodo_pagamento: paymentMethod,
      limite_restante: (remainingBeforePurchaseCents - intention.valor_total_cents) / 100,
      data: transactionDate,
    }
  } catch (error) {
    if (transactionOpen) db.exec('ROLLBACK')
    if (isDuplicateIntention(error)) {
      return purchaseRejected('INTENCAO_JA_PAGA', 'Esta intenção de compra já foi utilizada.')
    }
    throw error
  }
}
