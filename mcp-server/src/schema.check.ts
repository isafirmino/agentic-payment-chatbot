import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { bootstrapSchema, PRODUCTS, seedProducts } from './schema.ts'

test('bootstrapSchema cria produtos e intencoes de forma idempotente', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  bootstrapSchema(db)
  bootstrapSchema(db)

  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all() as Array<{ name: string }>
  assert.deepEqual(tables.map(({ name }) => name), ['intencoes', 'produtos'])
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
