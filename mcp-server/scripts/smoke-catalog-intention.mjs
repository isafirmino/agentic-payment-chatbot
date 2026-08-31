import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import jwt from 'jsonwebtoken'

const MCP_URL = process.env.MCP_URL ?? 'http://localhost:4000/mcp'
const JWT_SECRET = process.env.JWT_SECRET ?? 'workshop-dev-secret-do-not-use-in-prod'
const CPF = '12345678900'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parse(result) {
  const text = result.content?.find(({ type }) => type === 'text')?.text
  if (!text) throw new Error('tool returned no text content')
  return JSON.parse(text)
}

async function main() {
  const unauthorized = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  })
  assert(unauthorized.status === 401, `expected HTTP 401, received ${unauthorized.status}`)

  const token = jwt.sign({}, JWT_SECRET, { subject: CPF, expiresIn: '1h', algorithm: 'HS256' })
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  })
  const client = new Client({ name: 'catalog-intention-smoke', version: '1.0.0' })
  await client.connect(transport)

  try {
    const tools = await client.listTools()
    assert(tools.tools.map(({ name }) => name).join(',') === 'listar_catalogo,registrar_intencao', 'unexpected tools')

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
  } finally {
    await transport.close()
  }

  console.log('✔ Smoke test OK — auth, discovery, catalog and intention passed.')
}

main().catch((error) => {
  console.error('✘ Smoke test failed:', error.message)
  process.exitCode = 1
})
