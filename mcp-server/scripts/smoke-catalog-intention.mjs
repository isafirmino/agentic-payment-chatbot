import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import jwt from 'jsonwebtoken'
import { getDb } from '../src/db.ts'

const MCP_URL = process.env.MCP_URL ?? 'http://localhost:4000/mcp'
const JWT_SECRET = process.env.JWT_SECRET ?? 'workshop-dev-secret-do-not-use-in-prod'
const CPF = String(Date.now()).slice(-11)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parse(result) {
  const text = result.content?.find(({ type }) => type === 'text')?.text
  if (!text) throw new Error('tool returned no text content')
  return JSON.parse(text)
}

function cleanupSmokeData(db) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const purchases = db.prepare(
      `SELECT intencoes.produto_id, intencoes.quantidade
       FROM transacoes
       JOIN intencoes ON intencoes.id = transacoes.intencao_id
       WHERE transacoes.owner_cpf = ?`,
    ).all(CPF)
    for (const purchase of purchases) {
      db.prepare(`UPDATE produtos SET estoque = estoque + ? WHERE id = ?`).run(
        purchase.quantidade,
        purchase.produto_id,
      )
    }
    db.prepare(`DELETE FROM transacoes WHERE owner_cpf = ?`).run(CPF)
    db.prepare(`DELETE FROM intencoes WHERE owner_cpf = ?`).run(CPF)
    db.prepare(`DELETE FROM usuarios WHERE cpf = ?`).run(CPF)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

async function main() {
  const db = getDb()
  // Fixture do smoke apenas: o bootstrap da tabela continua pertencendo ao
  // api-auth, e o servidor MCP não a cria durante a inicialização normal.
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      cpf TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      limite_cents INTEGER NOT NULL DEFAULT 100000
    )
  `)
  db.prepare(
    `INSERT INTO usuarios (cpf, nome, password_hash, limite_cents)
     VALUES (?, 'Smoke Task 8', 'smoke:not-a-login', 100000)`,
  ).run(CPF)

  let transport
  try {
    const unauthorized = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    })
    assert(unauthorized.status === 401, `expected HTTP 401, received ${unauthorized.status}`)

    const token = jwt.sign({}, JWT_SECRET, { subject: CPF, expiresIn: '1h', algorithm: 'HS256' })
    transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    })
    const client = new Client({ name: 'purchase-payment-smoke', version: '1.0.0' })
    await client.connect(transport)

    const tools = await client.listTools()
    assert(
      tools.tools.map(({ name }) => name).join(',') === 'listar_catalogo,registrar_intencao,realizar_compra',
      'unexpected tools',
    )

    const catalog = parse(await client.callTool({ name: 'listar_catalogo', arguments: { categoria: 'audio' } }))
    assert(catalog.produtos.length === 1 && catalog.produtos[0].preco === 249.9, 'unexpected catalog')

    const intention = parse(await client.callTool({
      name: 'registrar_intencao',
      arguments: { produto_id: 'prod_001', quantidade: 2 },
    }))
    assert(intention.valor_total === 499.8, 'unexpected intention total')
    assert(intention.valido_por_minutos === 5, 'unexpected intention validity')

    const rejected = parse(await client.callTool({
      name: 'registrar_intencao',
      arguments: { produto_id: 'prod_004', quantidade: 6 },
    }))
    assert(rejected.erro === 'ESTOQUE_INSUFICIENTE', 'expected ESTOQUE_INSUFICIENTE')

    const purchase = parse(await client.callTool({
      name: 'realizar_compra',
      arguments: { intencao_id: intention.intencao_id, metodo_pagamento: 'pix' },
    }))
    assert(purchase.status === 'aprovado', 'expected approved purchase')
    assert(purchase.intencao_id === intention.intencao_id, 'unexpected purchase intention')
    assert(purchase.valor === 499.8, 'unexpected purchase value')
    assert(purchase.metodo_pagamento === 'pix', 'unexpected payment method')
    assert(purchase.limite_restante === 500.2, 'unexpected remaining limit')

    console.log('✔ Smoke test OK — auth, discovery, catalog, intention and purchase passed.')
  } finally {
    await transport?.close()
    cleanupSmokeData(db)
    db.close()
  }
}

main().catch((error) => {
  console.error('✘ Smoke test failed:', error.message)
  process.exitCode = 1
})
