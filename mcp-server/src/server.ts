import { AsyncLocalStorage } from 'node:async_hooks'
import express from 'express'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CONVERSA_HEADER, resolveConversaId, resolveCpf, resolveJwtSecret, Unauthorized } from './auth.ts'
import { getDb } from './db.ts'
import { bootstrapSchema, seedProducts } from './schema.ts'
import { listarCatalogo, realizarCompra, registrarIntencao } from './tools.ts'

const PORT = Number(process.env.PORT ?? 4000)
const JWT_SECRET = resolveJwtSecret()
const requestIdentity = new AsyncLocalStorage<{ cpf: string; conversaId?: string }>()

function currentCpf(): string {
  const identity = requestIdentity.getStore()
  if (!identity) throw new Error('missing authenticated request context')
  return identity.cpf
}

/**
 * Exigido pelas tools que criam ou consomem intenção. Lança quando o cabeçalho
 * não veio: sem conversa não há como amarrar a intenção, e aceitar a chamada
 * transformaria a proteção em opcional — bastaria omitir o cabeçalho. Ver
 * ADR 0007.
 */
function currentConversaId(): string {
  const identity = requestIdentity.getStore()
  if (!identity) throw new Error('missing authenticated request context')
  if (!identity.conversaId) throw new Unauthorized('missing conversation id')
  return identity.conversaId
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
      quantidade: z.number().describe('Quantidade desejada; a regra de inteiro positivo é validada no backend.'),
    },
  },
  async ({ produto_id, quantidade }) =>
    json(registrarIntencao(getDb(), currentCpf(), currentConversaId(), { produto_id, quantidade })),
)

mcp.registerTool(
  'realizar_compra',
  {
    description: 'Confirma o pagamento de uma intenção pendente usando cartão ou pix.',
    inputSchema: {
      intencao_id: z.string().describe('Identificador retornado por registrar_intencao.'),
      metodo_pagamento: z.string().describe('Método de pagamento: cartao ou pix.'),
    },
  },
  async ({ intencao_id, metodo_pagamento }) =>
    json(realizarCompra(getDb(), currentCpf(), currentConversaId(), { intencao_id, metodo_pagamento })),
)

const app = express()
app.use(express.json())

app.post('/mcp', async (req, res) => {
  let cpf: string
  let conversaId: string | undefined
  try {
    cpf = resolveCpf(req.headers.authorization, JWT_SECRET)
    // Ausente é permitido aqui: o catálogo não exige conversa. Quem exige são
    // as tools de intenção, via currentConversaId(). Malformado, ao contrário,
    // é recusado já — cabeçalho inválido é erro do cliente, não omissão.
    conversaId = resolveConversaId(req.headers[CONVERSA_HEADER])
  } catch (error) {
    if (error instanceof Unauthorized) return res.status(401).json({ error: 'unauthorized' })
    throw error
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => transport.close())
  await mcp.connect(transport)
  await requestIdentity.run({ cpf, conversaId }, () => transport.handleRequest(req, res, req.body))
})

const db = getDb()
bootstrapSchema(db)
seedProducts(db)

app.listen(PORT, () => console.log(`agentic-payment (MCP) on http://localhost:${PORT}/mcp`))
