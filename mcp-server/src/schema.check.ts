import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { bootstrapSchema, PRODUCTS, seedProducts } from './schema.ts'

test('bootstrapSchema cria produtos, intencoes e transacoes de forma idempotente', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  bootstrapSchema(db)
  bootstrapSchema(db)

  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all() as Array<{ name: string }>
  assert.deepEqual(tables.map(({ name }) => name), ['intencoes', 'produtos', 'transacoes'])
})
test('transacoes referencia intencoes e impede pagamento duplicado', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  bootstrapSchema(db)
  seedProducts(db)
  db.prepare(
    `INSERT INTO intencoes
      (id, produto_id, quantidade, valor_total_cents, status, owner_cpf, criada_em, expira_em)
     VALUES ('int_schema', 'prod_001', 1, 24990, 'pendente', '123', '2026-01-01', '2026-01-02')`,
  ).run()

  const foreignKeys = db.prepare(`PRAGMA foreign_key_list('transacoes')`).all() as Array<{
    table: string; from: string; to: string
  }>
  assert.ok(foreignKeys.some((key) => key.table === 'intencoes' && key.from === 'intencao_id' && key.to === 'id'))

  db.prepare(
    `INSERT INTO transacoes (id, intencao_id, valor_cents, metodo_pagamento, owner_cpf, data)
     VALUES ('tx_1', 'int_schema', 24990, 'pix', '123', '2026-01-01')`,
  ).run()
  assert.throws(
    () => db.prepare(
      `INSERT INTO transacoes (id, intencao_id, valor_cents, metodo_pagamento, owner_cpf, data)
       VALUES ('tx_2', 'int_schema', 24990, 'pix', '123', '2026-01-01')`,
    ).run(),
    /UNIQUE constraint failed: transacoes\.intencao_id/,
  )
  assert.throws(
    () => db.prepare(
      `INSERT INTO transacoes (id, intencao_id, valor_cents, metodo_pagamento, owner_cpf, data)
       VALUES ('tx_3', 'int_missing', 100, 'pix', '123', '2026-01-01')`,
    ).run(),
    /FOREIGN KEY constraint failed/,
  )
})
test('seedProducts insere cinco produtos sem sobrescrever estado existente', () => {
  const db = new DatabaseSync(':memory:')
  bootstrapSchema(db)
  seedProducts(db)
  db.prepare(`UPDATE produtos SET estoque = 3 WHERE id = 'prod_001'`).run()
  seedProducts(db)

  const count = db.prepare(`SELECT COUNT(*) AS total FROM produtos`).get() as { total: number }
  const product = db.prepare(`SELECT preco_cents, estoque FROM produtos WHERE id = 'prod_001'`).get() as { preco_cents: number; estoque: number }
  assert.equal(count.total, PRODUCTS.length)
  assert.equal(product.preco_cents, 24990)
  assert.equal(product.estoque, 3)
})
