import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { registrarChamada, resolveDesfecho, resumirResultado } from './audit.ts'
import { bootstrapSchema, seedProducts } from './schema.ts'
import { realizarCompra, registrarIntencao } from './tools.ts'

const CPF = '12345678900'
const NOW = new Date('2026-08-31T12:00:00.000Z')

function setupDb(limiteCents = 30000): DatabaseSync {
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
    `INSERT INTO usuarios (cpf, nome, password_hash, limite_cents) VALUES (?, 'Alice', 'hash', ?)`,
  ).run(CPF, limiteCents)
  return db
}

function chamadas(db: DatabaseSync) {
  return db.prepare(`SELECT * FROM chamadas_tool ORDER BY id`).all() as Array<{
    tool: string
    owner_cpf: string
    argumentos: string
    resultado: string
    desfecho: string
    data: string
  }>
}

test('resolveDesfecho distingue aprovação, recusa e consulta ao catálogo', () => {
  assert.equal(resolveDesfecho('realizar_compra', { status: 'aprovado' }), 'aprovado')
  assert.equal(resolveDesfecho('realizar_compra', { status: 'recusado', erro: 'LIMITE_EXCEDIDO' }), 'LIMITE_EXCEDIDO')
  assert.equal(resolveDesfecho('registrar_intencao', { erro: 'ESTOQUE_INSUFICIENTE' }), 'ESTOQUE_INSUFICIENTE')
  // O catálogo não tem status nem erro: listar é sempre "deu certo".
  assert.equal(resolveDesfecho('listar_catalogo', { produtos: [] }), 'consultado')
  assert.equal(resolveDesfecho('registrar_intencao', null), 'desconhecido')
  assert.equal(resolveDesfecho('registrar_intencao', 'texto solto'), 'desconhecido')
})

test('resumirResultado encolhe o catálogo e preserva as tools de intenção', () => {
  const catalogo = { produtos: [{ id: 'prod_001' }, { id: 'prod_002' }] }
  assert.equal(resumirResultado('listar_catalogo', catalogo), JSON.stringify({ produtos: 2 }))

  const compra = { status: 'aprovado', transacao_id: 'tx_abc', valor: 249.9 }
  assert.equal(resumirResultado('realizar_compra', compra), JSON.stringify(compra))
})

test('resumirResultado tolera catálogo sem a lista esperada', () => {
  assert.equal(resumirResultado('listar_catalogo', null), JSON.stringify({ produtos: 0 }))
  assert.equal(resumirResultado('listar_catalogo', {}), JSON.stringify({ produtos: 0 }))
})

test('registrarChamada grava quem, quando, o que foi pedido e o resultado', () => {
  const db = setupDb()
  registrarChamada(
    db,
    {
      tool: 'registrar_intencao',
      ownerCpf: CPF,
      argumentos: { produto_id: 'prod_001', quantidade: 2 },
      resultado: { intencao_id: 'int_abc', valor_total: 499.8 },
    },
    NOW,
  )

  const [linha] = chamadas(db)
  assert.equal(linha.tool, 'registrar_intencao')
  assert.equal(linha.owner_cpf, CPF)
  assert.deepEqual(JSON.parse(linha.argumentos), { produto_id: 'prod_001', quantidade: 2 })
  assert.deepEqual(JSON.parse(linha.resultado), { intencao_id: 'int_abc', valor_total: 499.8 })
  assert.equal(linha.data, NOW.toISOString())
})

test('registrarChamada nunca propaga falha de gravação', () => {
  const db = new DatabaseSync(':memory:')
  // Sem bootstrapSchema: a tabela não existe, então o INSERT falha.
  const erros: unknown[] = []
  const original = console.error
  console.error = (...args) => erros.push(args)
  try {
    assert.doesNotThrow(() =>
      registrarChamada(db, { tool: 'realizar_compra', ownerCpf: CPF, argumentos: {}, resultado: {} }),
    )
  } finally {
    console.error = original
  }
  assert.equal(erros.length, 1)
})

test('uma compra recusada por limite nao cria transacao, mas deixa rastro no log', () => {
  // O caso que justifica a feature: realizarCompra faz ROLLBACK de tudo o que
  // tocou, então um log gravado por dentro da transação sumiria junto com a
  // tentativa que ele deveria documentar. Ver ADR 0008.
  const db = setupDb(10000)
  const intencao = registrarIntencao(db, CPF, { produto_id: 'prod_001', quantidade: 1 }, NOW) as {
    intencao_id: string
  }
  const args = { intencao_id: intencao.intencao_id, metodo_pagamento: 'cartao' as const }
  const recusa = realizarCompra(db, CPF, args, NOW)

  registrarChamada(db, { tool: 'realizar_compra', ownerCpf: CPF, argumentos: args, resultado: recusa }, NOW)

  assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM transacoes`).get() as { n: number }).n, 0)

  const [linha] = chamadas(db)
  assert.equal(linha.desfecho, 'LIMITE_EXCEDIDO')
  assert.equal(JSON.parse(linha.argumentos).intencao_id, intencao.intencao_id)
})

test('o log preserva a ordem cronológica de uma sessão inteira', () => {
  const db = setupDb()
  const registrar = (tool: string, resultado: unknown) =>
    registrarChamada(db, { tool, ownerCpf: CPF, argumentos: {}, resultado }, NOW)

  registrar('listar_catalogo', { produtos: [1, 2, 3] })
  registrar('registrar_intencao', { intencao_id: 'int_a' })
  registrar('realizar_compra', { status: 'recusado', erro: 'LIMITE_EXCEDIDO' })
  registrar('realizar_compra', { status: 'aprovado', transacao_id: 'tx_a' })

  assert.deepEqual(
    chamadas(db).map(({ tool, desfecho }) => `${tool}:${desfecho}`),
    [
      'listar_catalogo:consultado',
      'registrar_intencao:desconhecido',
      'realizar_compra:LIMITE_EXCEDIDO',
      'realizar_compra:aprovado',
    ],
  )
})
