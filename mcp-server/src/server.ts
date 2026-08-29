import express from 'express'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { DEFAULT_TZ, getTime, listItems } from './tools.ts'

const PORT = Number(process.env.PORT ?? 4000)

const mcp = new McpServer({ name: 'ollama-tools', version: '1.0.0' })

mcp.registerTool(
  'get_time',
  {
    description: `Data e hora atuais. Já retorna no horário de Brasília (UTC-3) por padrão.`,
    inputSchema: {
      timezone: z.string().optional().describe(`Fuso IANA, ex.: America/Sao_Paulo. Padrão: ${DEFAULT_TZ}.`),
    },
  },
  async ({ timezone }) => json(getTime({ timezone }))
)

mcp.registerTool(
  'list_items',
  {
    description: 'Lista os itens à venda e seus preços em reais. Opcionalmente filtra por nome.',
    inputSchema: {
      search: z.string().optional().describe('Trecho do nome do item, sem diferenciar maiúsculas.'),
    },
  },
  async ({ search }) => json(listItems({ search }))
)

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] }
}

const app = express()
app.use(express.json())

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => transport.close())
  await mcp.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

app.listen(PORT, () => console.log(`ollama-tools (MCP) on http://localhost:${PORT}/mcp`))
