// Prova, de forma reproduzível, que `realizar_compra` recusa identificadores
// de intenção inválidos — chamando a tool direto no servidor MCP, com o JWT do
// usuário e SEM nenhum modelo no meio.
//
// Por que existe: as capturas de tela do README dependem de o agente aceitar
// tentar algo que o system prompt proíbe. Quando ele se recusa sozinho — o que
// é bom comportamento — a captura demonstra o prompt, não a validação no
// servidor. E prompt pode ser trocado junto com o modelo. Este script exercita
// a camada que decide de verdade.
//
// Uso, com api-auth e mcp-server no ar:
//   node scripts/verificar-recusas.mjs <cpf> <senha> [intencao_ja_paga]
//
// Exemplo:
//   node scripts/verificar-recusas.mjs 11122233344 senha123 int_a04132

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:3001'
const MCP_URL = process.env.MCP_URL ?? 'http://localhost:4000/mcp'
const RAIZ_REPO = join(import.meta.dirname, '..')

const [cpf, senha, intencaoPaga] = process.argv.slice(2)

if (!cpf || !senha) {
  console.error('\nUso: node scripts/verificar-recusas.mjs <cpf> <senha> [intencao_ja_paga]\n')
  process.exitCode = 1
} else {
  let client
  try {
    const login = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, senha }),
    })
    if (!login.ok) {
      throw new Error(`login falhou (${login.status}). Confira CPF, senha e se o api-auth está no ar.`)
    }
    const sessao = await login.json()

    // O SDK do MCP vem instalado no chat-web; este script não tem package.json
    // próprio, então importa de lá pelo caminho, como o verify-shared-db faz
    // com os db.ts dos serviços.
    const sdk = `${RAIZ_REPO}/chat-web/node_modules/@modelcontextprotocol/sdk/dist/esm/client`
    const { Client } = await import(pathToFileURL(`${sdk}/index.js`))
    const { StreamableHTTPClientTransport } = await import(pathToFileURL(`${sdk}/streamableHttp.js`))

    client = new Client({ name: 'verificar-recusas', version: '1.0.0' })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(MCP_URL), {
        requestInit: {
          headers: {
            Authorization: `Bearer ${sessao.token}`,
            // Qualquer cliente MCP precisa identificar a conversa para usar as
            // tools de intenção (ADR 0007). Aqui geramos uma, como o chat faz
            // a cada vez que a página monta.
            'X-Conversa-Id': crypto.randomUUID(),
          },
        },
      }),
    )

    console.log(`\nAutenticado como ${sessao.nome} (CPF ${sessao.cpf}).`)
    console.log('O CPF vem do JWT — nunca dos argumentos da tool.\n')

    // Duas camadas recusam, e a distinção importa:
    //
    //   'backend' — a tool rodou e devolveu recusa estruturada, com código.
    //   'schema'  — o protocolo barrou antes de a tool rodar, porque o
    //               inputSchema não aceita o valor (ver ADR 0005 e task #20).
    //
    // O método de pagamento migrou de 'backend' para 'schema' quando o
    // inputSchema virou z.enum(['cartao','pix']): METODO_INVALIDO deixou de ser
    // alcançável por esta via, e a recusa passou a acontecer mais cedo.
    const casos = [
      ['identificador inventado', { intencao_id: 'int_falsa123', metodo_pagamento: 'pix' }, 'INTENCAO_INVALIDA'],
      ['identificador plausível', { intencao_id: 'int_aprovada', metodo_pagamento: 'cartao' }, 'INTENCAO_INVALIDA'],
      ['identificador vazio', { intencao_id: '', metodo_pagamento: 'pix' }, 'INTENCAO_INVALIDA'],
      ['método fora do contrato', { intencao_id: 'int_falsa123', metodo_pagamento: 'boleto' }, 'schema'],
    ]
    if (intencaoPaga) {
      casos.push(['intenção já paga', { intencao_id: intencaoPaga, metodo_pagamento: 'pix' }, 'INTENCAO_JA_PAGA'])
    }

    let divergencias = 0

    for (const [rotulo, args, esperado] of casos) {
      const saida = await client.callTool({ name: 'realizar_compra', arguments: args })
      const texto = saida.content?.find((c) => c.type === 'text')?.text ?? ''

      let ok
      let obtido
      if (esperado === 'schema') {
        // Recusa do protocolo: o callTool resolve normalmente e marca isError,
        // com "Invalid arguments" no texto — não é JSON de domínio.
        ok = saida.isError === true && /Invalid arguments/i.test(texto)
        obtido = ok ? 'schema' : `isError=${saida.isError}`
      } else {
        try {
          obtido = JSON.parse(texto).erro
        } catch {
          obtido = undefined
        }
        ok = obtido === esperado
      }
      if (!ok) divergencias++

      console.log(`${ok ? '✔' : '✖'} ${rotulo}`)
      console.log(`    realizar_compra ${JSON.stringify(args)}`)
      console.log(`    -> ${texto}`)
      if (!ok) console.log(`    ESPERADO "${esperado}", veio "${obtido}"`)
      console.log()
    }

    if (divergencias > 0) {
      console.error(`✖ ${divergencias} caso(s) não recusaram como esperado.\n`)
      process.exitCode = 1
    } else {
      console.log(`✔ Todos os ${casos.length} casos foram recusados — pelo backend ou pelo schema.\n`)
    }
  } catch (erro) {
    console.error(`\n✖ ${erro instanceof Error ? erro.message : erro}\n`)
    // exitCode em vez de exit(): process.exit() abortaria antes do finally,
    // deixando a conexão MCP aberta.
    process.exitCode = 1
  } finally {
    await client?.close()
  }
}
