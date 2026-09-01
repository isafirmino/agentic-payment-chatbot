// Log auditável de chamadas de tool (extra do desafio: "quem, quando, quanto,
// resultado" de CADA chamada).
//
// Irmão do consultar-transacoes.mjs, e não uma opção dele: são relatórios
// diferentes. Aquele é financeiro e agrupado por usuário; este é cronológico e
// por chamada, e inclui as recusas — que o outro nunca vê, porque a tabela
// `transacoes` só guarda compras aprovadas.
//
// Uso:
//   node scripts/consultar-chamadas.mjs [cpf] [tool]
//
// Exemplos:
//   node scripts/consultar-chamadas.mjs
//   node scripts/consultar-chamadas.mjs 11122233344
//   node scripts/consultar-chamadas.mjs 11122233344 realizar_compra

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { resolveDatabasePath } from '../mcp-server/src/db.ts'

const RAIZ_REPO = join(import.meta.dirname, '..')
const PACOTE = 'mcp-server'
const [cpfFiltro, toolFiltro] = process.argv.slice(2)

class FalhaDeConsulta extends Error {}

/**
 * Mesma leitura de .env do consultar-transacoes.mjs, e pelo mesmo motivo: o
 * `dotenv/config` de dentro do db.ts carrega o .env do diretório de execução,
 * que é a raiz do repo quando o script roda daqui — nunca o do serviço.
 */
function databasePathDeclarado() {
  let conteudo
  try {
    conteudo = readFileSync(join(RAIZ_REPO, PACOTE, '.env'), 'utf8')
  } catch {
    return undefined
  }
  const linha = conteudo
    .split('\n')
    .map((l) => l.trim().replace(/^export\s+/, ''))
    .findLast((l) => l.startsWith('DATABASE_PATH='))
  const valor = linha?.slice('DATABASE_PATH='.length).trim()
  return valor?.replace(/^(['"`])([\s\S]*)\1$/, '$2')
}

const dataHora = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}

/** Corta o JSON para o relatório caber na tela, sem alterar o que está gravado. */
const encurtar = (texto, limite) =>
  texto.length <= limite ? texto : `${texto.slice(0, limite - 1)}…`

let db

try {
  const caminho = resolveDatabasePath(
    process.env.DATABASE_PATH ?? databasePathDeclarado(),
    join(RAIZ_REPO, PACOTE),
  )

  if (!existsSync(caminho)) {
    throw new FalhaDeConsulta(
      `Banco não encontrado em ${caminho}\n` +
        '  Suba o mcp-server ao menos uma vez pra que ele seja criado.',
    )
  }

  // readOnly: um relatório de auditoria não deve poder alterar aquilo que
  // audita, nem por engano.
  db = new DatabaseSync(caminho, { readOnly: true })
  db.exec('PRAGMA busy_timeout = 5000')

  const existe = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chamadas_tool'`)
    .get()
  if (!existe) {
    throw new FalhaDeConsulta(
      'A tabela `chamadas_tool` não existe neste banco.\n' +
        '  Suba o mcp-server ao menos uma vez (ele cria essa tabela).',
    )
  }

  const condicoes = []
  const parametros = []
  if (cpfFiltro) {
    condicoes.push('owner_cpf = ?')
    parametros.push(cpfFiltro)
  }
  if (toolFiltro) {
    condicoes.push('tool = ?')
    parametros.push(toolFiltro)
  }
  const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''

  const linhas = db
    .prepare(`SELECT * FROM chamadas_tool ${onde} ORDER BY data, id`)
    .all(...parametros)

  const filtro = [cpfFiltro && `CPF ${cpfFiltro}`, toolFiltro && `tool ${toolFiltro}`]
    .filter(Boolean)
    .join(', ')
  console.log(`\nChamadas de tool — ${caminho}${filtro ? `\nFiltro: ${filtro}` : ''}\n`)

  if (linhas.length === 0) {
    console.log('  Nenhuma chamada registrada.\n')
  }

  for (const linha of linhas) {
    console.log(`${dataHora(linha.data)}  ${linha.tool}  ${linha.owner_cpf}  → ${linha.desfecho}`)
    console.log(`    pedido:   ${encurtar(linha.argumentos, 110)}`)
    console.log(`    resposta: ${encurtar(linha.resultado, 110)}\n`)
  }

  if (linhas.length > 0) {
    const porDesfecho = new Map()
    for (const { desfecho } of linhas) {
      porDesfecho.set(desfecho, (porDesfecho.get(desfecho) ?? 0) + 1)
    }
    const resumo = [...porDesfecho.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([desfecho, total]) => `${desfecho}: ${total}`)
      .join('  |  ')
    console.log(`${linhas.length} chamada(s).  ${resumo}\n`)
  }
} catch (erro) {
  if (!(erro instanceof FalhaDeConsulta)) throw erro
  console.error(`\n✖ ${erro.message}\n`)
  // exitCode em vez de exit(): process.exit() aborta antes do finally e
  // deixaria a conexão aberta.
  process.exitCode = 1
} finally {
  db?.close()
}
