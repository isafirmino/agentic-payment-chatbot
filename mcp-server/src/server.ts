import { AsyncLocalStorage } from 'node:async_hooks'
import express from 'express'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { resolveCpf, resolveJwtSecret, Unauthorized } from './auth.ts'
import { getDb } from './db.ts'
import { bootstrapSchema, seedProducts } from './schema.ts'
import { listarCatalogo, realizarCompra, registrarIntencao } from './tools.ts'

const PORT = Number(process.env.PORT ?? 4000)
const JWT_SECRET = resolveJwtSecret()
const requestIdentity = new AsyncLocalStorage<{ cpf: string }>()

function currentCpf(): string {
  const identity = requestIdentity.getStore()
  if (!identity) throw new Error('missing authenticated request context')
  return identity.cpf
}

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] }
}

const mcp = new McpServer({ name: 'agentic-payment', version: '1.0.0' })

mcp.registerTool(
  'listar_catalogo',
  {
    description: 'Lista os produtos disponíveis, opcionalmente filtrados por categoria.',
    inputSchema: {
      categoria: z.string().optional().describe('Categoria opcional, por exemplo: monitores.'),
    },
  },
  async ({ categoria }) => json(listarCatalogo(getDb(), { categoria })),
)

mcp.registerTool(
  'registrar_intencao',
  {
    description: 'Registra por cinco minutos a intenção de comprar um produto. Não realiza pagamento.',
    inputSchema: {
      produto_id: z.string().describe('Identificador de um produto do catálogo.'),
      // int().positive() em vez de number(): o inputSchema é o contrato que o
      // modelo recebe na descoberta, então restringir aqui evita a chamada
      // errada em vez de só recusá-la depois. O backend continua validando —
      // o schema orienta, não protege.
      quantidade: z.number().int().positive().describe('Quantidade desejada, inteiro maior que zero.'),
    },
  },
  async ({ produto_id, quantidade }) =>
    json(registrarIntencao(getDb(), currentCpf(), { produto_id, quantidade })),
)

mcp.registerTool(
  'realizar_compra',
  {
    description: 'Confirma o pagamento de uma intenção pendente usando cartão ou pix.',
    inputSchema: {
      intencao_id: z.string().describe('Identificador retornado por registrar_intencao.'),
      // enum em vez de string(): o desafio tipa este campo como
      // "cartao" | "pix", e anunciar `string` deixava o modelo escolher
      // qualquer coisa pra descobrir o erro só depois da chamada.
      metodo_pagamento: z.enum(['cartao', 'pix']).describe('Método de pagamento.'),
    },
  },
  async ({ intencao_id, metodo_pagamento }) =>
    json(realizarCompra(getDb(), currentCpf(), { intencao_id, metodo_pagamento })),
)

const app = express()
app.use(express.json())

app.post('/mcp', async (req, res) => {
  let cpf: string
  try {
    cpf = resolveCpf(req.headers.authorization, JWT_SECRET)
  } catch (error) {
    if (error instanceof Unauthorized) return res.status(401).json({ error: 'unauthorized' })
    throw error
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => transport.close())
  await mcp.connect(transport)
  await requestIdentity.run({ cpf }, () => transport.handleRequest(req, res, req.body))
})

const db = getDb()
bootstrapSchema(db)
seedProducts(db)

app.listen(PORT, () => console.log(`agentic-payment (MCP) on http://localhost:${PORT}/mcp`))
