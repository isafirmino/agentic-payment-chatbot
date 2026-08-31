import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { bootstrapSchema, seedProducts } from './schema.ts'
import { generateIntentionId, INTENTION_VALIDITY_MINUTES, listarCatalogo, registrarIntencao, type Rejected } from './tools.ts'

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  bootstrapSchema(db)
  seedProducts(db)
  return db
}

function errorCode(result: unknown): Rejected['erro'] {
  assert.equal((result as Rejected).status, 'recusado')
  return (result as Rejected).erro
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
