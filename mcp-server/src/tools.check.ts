import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { Worker } from 'node:worker_threads'
import { bootstrapSchema, seedProducts } from './schema.ts'
import {
  generateIntentionId,
  generateTransactionId,
  INTENTION_VALIDITY_MINUTES,
  listarCatalogo,
  realizarCompra,
  registrarIntencao,
  type PurchaseRejected,
  type Rejected,
} from './tools.ts'

const OWNER_CPF = '12345678900'
const NOW = new Date('2026-08-31T12:00:00.000Z')

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  bootstrapSchema(db)
  seedProducts(db)
  db.exec(`
    CREATE TABLE usuarios (
      cpf TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      limite_cents INTEGER NOT NULL
    )
  `)
  db.prepare(
    `INSERT INTO usuarios (cpf, nome, password_hash, limite_cents)
     VALUES (?, 'Alice', 'hash', 1000000)`,
  ).run(OWNER_CPF)
  return db
}

function errorCode(result: unknown): Rejected['erro'] {
  assert.equal((result as Rejected).status, 'recusado')
  return (result as Rejected).erro
}

function purchaseErrorCode(result: unknown): PurchaseRejected['erro'] {
  assert.equal((result as PurchaseRejected).status, 'recusado')
  return (result as PurchaseRejected).erro
}

function createIntention(
  db: DatabaseSync,
  options: { ownerCpf?: string; productId?: string; quantity?: number; now?: Date } = {},
): string {
  const result = registrarIntencao(
    db,
    options.ownerCpf ?? OWNER_CPF,
    { produto_id: options.productId ?? 'prod_001', quantidade: options.quantity ?? 1 },
    options.now ?? NOW,
  )
  assert.ok('intencao_id' in result)
  return result.intencao_id
}

function runConcurrentPurchase(databasePath: string, intentionId: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./purchase-concurrency-worker.ts', import.meta.url), {
      workerData: { databasePath, intentionId, ownerCpf: OWNER_CPF, now: NOW.toISOString() },
    })
    worker.once('message', resolve)
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`purchase worker stopped with exit code ${code}`))
    })
  })
}

test('listarCatalogo retorna os cinco produtos no contrato publico', () => {
  const result = listarCatalogo(setupDb(), {})
  assert.equal(result.produtos.length, 5)
  assert.deepEqual(result.produtos[0], { id: 'prod_001', nome: 'Fone Bluetooth', moeda: 'BRL', estoque: 20, preco: 249.9 })
  assert.ok(result.produtos.every((product) => !('categoria' in product) && !('preco_cents' in product)))
})
test('listarCatalogo filtra categoria sem diferenciar caixa e retorna vazio sem correspondencia', () => {
  const db = setupDb()
  assert.deepEqual(listarCatalogo(db, { categoria: ' MONITORES ' }).produtos.map(({ id }) => id), ['prod_003'])
  assert.deepEqual(listarCatalogo(db, { categoria: 'inexistente' }), { produtos: [] })
})

test('generateIntentionId usa o formato int_ com seis caracteres hexadecimais', () => {
  assert.match(generateIntentionId(), /^int_[0-9a-f]{6}$/)
})

test('generateTransactionId usa o formato tx_ com seis caracteres hexadecimais', () => {
  assert.match(generateTransactionId(), /^tx_[0-9a-f]{6}$/)
})

test('registrarIntencao calcula e persiste valor, proprietario e validade no backend', () => {
  const db = setupDb()
  const now = new Date('2026-08-31T12:00:00.000Z')
  const result = registrarIntencao(db, '12345678900', { produto_id: 'prod_002', quantidade: 2 }, now)

  assert.ok('intencao_id' in result)
  assert.equal(result.valor_total, 919.8)
  assert.equal(result.valido_por_minutos, INTENTION_VALIDITY_MINUTES)
  assert.equal(result.expira_em, '2026-08-31T12:05:00.000Z')

  const stored = db.prepare(`SELECT * FROM intencoes WHERE id = ?`).get(result.intencao_id) as {
    valor_total_cents: number; owner_cpf: string; status: string; criada_em: string
  }
  assert.equal(stored.valor_total_cents, 91980)
  assert.equal(stored.owner_cpf, '12345678900')
  assert.equal(stored.status, 'pendente')
  assert.equal(stored.criada_em, now.toISOString())
})

test('registrarIntencao recusa produto inexistente', () => {
  const db = setupDb()
  assert.equal(errorCode(registrarIntencao(db, '123', { produto_id: 'prod_999', quantidade: 1 })), 'PRODUTO_INEXISTENTE')
  assert.equal(errorCode(registrarIntencao(db, '123', { produto_id: ' ', quantidade: 1 })), 'PRODUTO_INEXISTENTE')
})

test('registrarIntencao recusa quantidade invalida', () => {
  const db = setupDb()
  for (const quantidade of [0, -1, 1.5, '2']) {
    assert.equal(errorCode(registrarIntencao(db, '123', { produto_id: 'prod_001', quantidade })), 'QUANTIDADE_INVALIDA')
  }
})

test('registrarIntencao recusa estoque insuficiente sem alterar estoque', () => {
  const db = setupDb()
  assert.equal(errorCode(registrarIntencao(db, '123', { produto_id: 'prod_004', quantidade: 6 })), 'ESTOQUE_INSUFICIENTE')
  assert.equal((db.prepare(`SELECT estoque FROM produtos WHERE id = 'prod_004'`).get() as { estoque: number }).estoque, 5)
})

test('registrarIntencao nao reserva estoque no caminho feliz', () => {
  const db = setupDb()
  registrarIntencao(db, '123', { produto_id: 'prod_001', quantidade: 2 })
  assert.equal((db.prepare(`SELECT estoque FROM produtos WHERE id = 'prod_001'`).get() as { estoque: number }).estoque, 20)
})

test('realizarCompra aprova cartao e persiste todos os efeitos atomicos', () => {
  const db = setupDb()
  const intentionId = createIntention(db, { quantity: 2 })
  const result = realizarCompra(
    db,
    OWNER_CPF,
    { intencao_id: intentionId, metodo_pagamento: 'cartao' },
    NOW,
  )

  assert.equal(result.status, 'aprovado')
  assert.ok('transacao_id' in result)
  assert.match(result.transacao_id, /^tx_[0-9a-f]{6}$/)
  assert.deepEqual(result, {
    status: 'aprovado',
    transacao_id: result.transacao_id,
    intencao_id: intentionId,
    valor: 499.8,
    metodo_pagamento: 'cartao',
    limite_restante: 9500.2,
    data: NOW.toISOString(),
  })

  const transaction = db.prepare(`SELECT * FROM transacoes WHERE id = ?`).get(result.transacao_id) as {
    intencao_id: string; valor_cents: number; metodo_pagamento: string; owner_cpf: string; data: string
  }
  assert.equal(transaction.intencao_id, intentionId)
  assert.equal(transaction.valor_cents, 49980)
  assert.equal(transaction.metodo_pagamento, 'cartao')
  assert.equal(transaction.owner_cpf, OWNER_CPF)
  assert.equal(transaction.data, NOW.toISOString())
  assert.equal((db.prepare(`SELECT estoque FROM produtos WHERE id = 'prod_001'`).get() as { estoque: number }).estoque, 18)
  assert.equal((db.prepare(`SELECT status FROM intencoes WHERE id = ?`).get(intentionId) as { status: string }).status, 'paga')
})

test('realizarCompra aprova pix e desconta transacoes anteriores do limite', () => {
  const db = setupDb()
  const firstId = createIntention(db, { productId: 'prod_005' })
  const secondId = createIntention(db, { productId: 'prod_001' })
  realizarCompra(db, OWNER_CPF, { intencao_id: firstId, metodo_pagamento: 'cartao' }, NOW)
  const result = realizarCompra(db, OWNER_CPF, { intencao_id: secondId, metodo_pagamento: 'pix' }, NOW)

  assert.equal(result.status, 'aprovado')
  assert.ok('limite_restante' in result)
  assert.equal(result.metodo_pagamento, 'pix')
  assert.equal(result.limite_restante, 9560.2)
})

test('realizarCompra recusa intencao inexistente, alheia e de usuario inexistente', () => {
  const db = setupDb()
  assert.equal(
    purchaseErrorCode(realizarCompra(db, OWNER_CPF, { intencao_id: 'int_missing', metodo_pagamento: 'pix' }, NOW)),
    'INTENCAO_INVALIDA',
  )

  const otherIntention = createIntention(db, { ownerCpf: '99999999999' })
  assert.equal(
    purchaseErrorCode(realizarCompra(db, OWNER_CPF, { intencao_id: otherIntention, metodo_pagamento: 'pix' }, NOW)),
    'INTENCAO_INVALIDA',
  )

  assert.equal(
    purchaseErrorCode(realizarCompra(db, '99999999999', { intencao_id: otherIntention, metodo_pagamento: 'pix' }, NOW)),
    'INTENCAO_INVALIDA',
  )
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM transacoes`).get() as { total: number }).total, 0)
})

test('realizarCompra recusa intencao ja paga', () => {
  const db = setupDb()
  const intentionId = createIntention(db)
  realizarCompra(db, OWNER_CPF, { intencao_id: intentionId, metodo_pagamento: 'pix' }, NOW)
  assert.equal(
    purchaseErrorCode(realizarCompra(db, OWNER_CPF, { intencao_id: intentionId, metodo_pagamento: 'pix' }, NOW)),
    'INTENCAO_JA_PAGA',
  )
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM transacoes`).get() as { total: number }).total, 1)
})

test('realizarCompra recusa intencao expirada e aceita no instante exato da expiracao', () => {
  const expiredDb = setupDb()
  const expiredId = createIntention(expiredDb)
  assert.equal(
    purchaseErrorCode(realizarCompra(
      expiredDb,
      OWNER_CPF,
      { intencao_id: expiredId, metodo_pagamento: 'pix' },
      new Date('2026-08-31T12:05:00.001Z'),
    )),
    'INTENCAO_EXPIRADA',
  )

  const boundaryDb = setupDb()
  const boundaryId = createIntention(boundaryDb)
  assert.equal(
    realizarCompra(
      boundaryDb,
      OWNER_CPF,
      { intencao_id: boundaryId, metodo_pagamento: 'pix' },
      new Date('2026-08-31T12:05:00.000Z'),
    ).status,
    'aprovado',
  )
})

test('realizarCompra recusa metodo diferente da grafia exata contratada', () => {
  for (const method of ['credito', 'PIX', ' pix ', '', 1]) {
    const db = setupDb()
    const intentionId = createIntention(db)
    assert.equal(
      purchaseErrorCode(realizarCompra(db, OWNER_CPF, { intencao_id: intentionId, metodo_pagamento: method }, NOW)),
      'METODO_INVALIDO',
    )
    assert.equal((db.prepare(`SELECT status FROM intencoes WHERE id = ?`).get(intentionId) as { status: string }).status, 'pendente')
  }
})

test('realizarCompra recusa limite excedido e aceita valor igual ao saldo', () => {
  const rejectedDb = setupDb()
  rejectedDb.prepare(`UPDATE usuarios SET limite_cents = 24989 WHERE cpf = ?`).run(OWNER_CPF)
  const rejectedId = createIntention(rejectedDb)
  assert.equal(
    purchaseErrorCode(realizarCompra(rejectedDb, OWNER_CPF, { intencao_id: rejectedId, metodo_pagamento: 'pix' }, NOW)),
    'LIMITE_EXCEDIDO',
  )

  const exactDb = setupDb()
  exactDb.prepare(`UPDATE usuarios SET limite_cents = 24990 WHERE cpf = ?`).run(OWNER_CPF)
  const exactId = createIntention(exactDb)
  const approved = realizarCompra(exactDb, OWNER_CPF, { intencao_id: exactId, metodo_pagamento: 'pix' }, NOW)
  assert.equal(approved.status, 'aprovado')
  assert.ok('limite_restante' in approved)
  assert.equal(approved.limite_restante, 0)
})

test('realizarCompra respeita a prioridade das validacoes', () => {
  const db = setupDb()
  db.prepare(`UPDATE usuarios SET limite_cents = 0 WHERE cpf = ?`).run(OWNER_CPF)
  const intentionId = createIntention(db)
  db.prepare(`UPDATE intencoes SET status = 'paga', expira_em = '2020-01-01T00:00:00.000Z' WHERE id = ?`).run(intentionId)
  assert.equal(
    purchaseErrorCode(realizarCompra(db, OWNER_CPF, { intencao_id: intentionId, metodo_pagamento: 'boleto' }, NOW)),
    'INTENCAO_JA_PAGA',
  )

  db.prepare(`UPDATE intencoes SET status = 'pendente' WHERE id = ?`).run(intentionId)
  assert.equal(
    purchaseErrorCode(realizarCompra(db, OWNER_CPF, { intencao_id: intentionId, metodo_pagamento: 'boleto' }, NOW)),
    'INTENCAO_EXPIRADA',
  )

  db.prepare(`UPDATE intencoes SET expira_em = '2030-01-01T00:00:00.000Z' WHERE id = ?`).run(intentionId)
  assert.equal(
    purchaseErrorCode(realizarCompra(db, OWNER_CPF, { intencao_id: intentionId, metodo_pagamento: 'boleto' }, NOW)),
    'METODO_INVALIDO',
  )
})

test('realizarCompra traduz UNIQUE de intencao e reverte os demais efeitos', () => {
  const db = setupDb()
  const intentionId = createIntention(db)
  db.prepare(
    `INSERT INTO transacoes (id, intencao_id, valor_cents, metodo_pagamento, owner_cpf, data)
     VALUES ('tx_existing', ?, 0, 'pix', ?, ?)`,
  ).run(intentionId, OWNER_CPF, NOW.toISOString())

  assert.equal(
    purchaseErrorCode(realizarCompra(db, OWNER_CPF, { intencao_id: intentionId, metodo_pagamento: 'pix' }, NOW)),
    'INTENCAO_JA_PAGA',
  )
  assert.equal((db.prepare(`SELECT estoque FROM produtos WHERE id = 'prod_001'`).get() as { estoque: number }).estoque, 20)
  assert.equal((db.prepare(`SELECT status FROM intencoes WHERE id = ?`).get(intentionId) as { status: string }).status, 'pendente')
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM transacoes`).get() as { total: number }).total, 1)
})

test('realizarCompra reverte a insercao se a atualizacao de estoque falhar', () => {
  const db = setupDb()
  const intentionId = createIntention(db)
  db.prepare(`UPDATE produtos SET estoque = 0 WHERE id = 'prod_001'`).run()

  assert.throws(
    () => realizarCompra(db, OWNER_CPF, { intencao_id: intentionId, metodo_pagamento: 'pix' }, NOW),
    /CHECK constraint failed/,
  )
  assert.equal((db.prepare(`SELECT COUNT(*) AS total FROM transacoes`).get() as { total: number }).total, 0)
  assert.equal((db.prepare(`SELECT status FROM intencoes WHERE id = ?`).get(intentionId) as { status: string }).status, 'pendente')
})

test('duas compras concorrentes aprovam a intencao apenas uma vez', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'purchase-concurrency-'))
  const databasePath = join(directory, 'app.db')
  t.after(() => rmSync(directory, { recursive: true, force: true }))

  const db = new DatabaseSync(databasePath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA foreign_keys = ON')
  bootstrapSchema(db)
  seedProducts(db)
  db.exec(`
    CREATE TABLE usuarios (
      cpf TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      limite_cents INTEGER NOT NULL
    )
  `)
  db.prepare(
    `INSERT INTO usuarios (cpf, nome, password_hash, limite_cents)
     VALUES (?, 'Alice', 'hash', 1000000)`,
  ).run(OWNER_CPF)
  const intentionId = createIntention(db)
  db.close()

  const results = await Promise.all([
    runConcurrentPurchase(databasePath, intentionId),
    runConcurrentPurchase(databasePath, intentionId),
  ])
  const statuses = results.map((result) => {
    const value = result as { status: string; erro?: string }
    return value.status === 'aprovado' ? value.status : value.erro
  }).sort()
  assert.deepEqual(statuses, ['INTENCAO_JA_PAGA', 'aprovado'])

  const verificationDb = new DatabaseSync(databasePath)
  assert.equal((verificationDb.prepare(`SELECT COUNT(*) AS total FROM transacoes`).get() as { total: number }).total, 1)
  assert.equal((verificationDb.prepare(`SELECT estoque FROM produtos WHERE id = 'prod_001'`).get() as { estoque: number }).estoque, 19)
  assert.equal((verificationDb.prepare(`SELECT status FROM intencoes WHERE id = ?`).get(intentionId) as { status: string }).status, 'paga')
  verificationDb.close()
})
