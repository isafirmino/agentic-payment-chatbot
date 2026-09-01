// Verifica que api-auth e mcp-server abrem o MESMO arquivo SQLite (ADR 0003).
//
// Confere duas coisas diferentes, porque são dois jeitos distintos de quebrar:
//   1. os .env dos dois serviços declaram DATABASE_PATH apontando pro mesmo
//      arquivo (o erro provável: alguém editou só um dos dois);
//   2. abrindo de verdade pelos db.ts dos dois serviços, as duas conexões
//      caem no mesmo arquivo (o erro provável: os dois db.ts, que são
//      arquivos duplicados, divergiram na lógica de resolução).
//
// Usa os db.ts reais em vez de repetir a resolução aqui — uma cópia da lógica
// passaria mesmo se o código de verdade estivesse errado.
//
// Uso: node scripts/verify-shared-db.mjs

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getDb as getAuthDb, resolveDatabasePath as resolveAuth } from '../api-auth/src/db.ts'
import { getDb as getMcpDb, resolveDatabasePath as resolveMcp } from '../mcp-server/src/db.ts'

const TABELA = '_verificacao_ambiente'
const RAIZ_REPO = join(import.meta.dirname, '..')

// Cada serviço é resolvido pela SUA própria cópia de resolveDatabasePath: usar
// a de um só pros dois deixaria passar justamente a divergência entre os dois
// db.ts duplicados que este script existe pra pegar.
const SERVICOS = [
  { nome: 'api-auth', resolver: resolveAuth },
  { nome: 'mcp-server', resolver: resolveMcp },
]

class FalhaDeVerificacao extends Error {}

function falhar(mensagem) {
  throw new FalhaDeVerificacao(mensagem)
}

/**
 * Lê DATABASE_PATH do .env do serviço. Devolve undefined se não houver .env.
 *
 * Faz a leitura na mão em vez de usar o dotenv porque este script roda da
 * raiz do repo, e o `dotenv/config` dos db.ts carrega o .env do diretório de
 * execução — nunca o de cada serviço. Cobre o que o dotenv aceita e aparece
 * num .env de verdade: prefixo `export` e valor entre aspas.
 *
 * Um `.env` por serviço é o que o `npm run dev` de cada um enxerga, porque
 * ali o diretório de execução é o do próprio serviço.
 */
function databasePathDeclarado(servico) {
  let conteudo
  try {
    conteudo = readFileSync(join(RAIZ_REPO, servico, '.env'), 'utf8')
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

/** Pergunta à própria conexão qual arquivo ela abriu, em vez de deduzir. */
function arquivoAberto(db) {
  return db.prepare('PRAGMA database_list').all().find((linha) => linha.name === 'main').file
}

let authDb
let mcpDb

try {
  console.log('1. DATABASE_PATH declarado no .env de cada serviço\n')

  const declarados = SERVICOS.map(({ nome, resolver }) => {
    const bruto = databasePathDeclarado(nome)
    const origem = bruto === undefined ? '(sem .env — usando o padrão)' : bruto
    const efetivo = resolver(bruto, join(RAIZ_REPO, nome))
    console.log(`   ${nome.padEnd(10)} ${origem}\n   ${' '.repeat(10)} -> ${efetivo}`)
    return efetivo
  })

  if (declarados[0] !== declarados[1]) {
    falhar(
      'Os .env dos dois serviços apontam pra arquivos DIFERENTES.\n' +
        '  Os dois precisam do MESMO arquivo, senão o limite de gasto gravado\n' +
        '  no cadastro não é o mesmo que a compra valida.\n' +
        '  Ver o .env.example de cada serviço.',
    )
  }

  console.log('\n2. Arquivo que cada conexão abre de fato\n')

  // Sem isto, a etapa 2 testaria sempre o caminho padrão: o `dotenv/config`
  // dentro de cada db.ts procura o .env no diretório de execução (a raiz do
  // repo, quando o script roda daqui), não no diretório de cada serviço.
  // Com um DATABASE_PATH customizado nos .env, as etapas 2 e 3 abririam o
  // arquivo padrão e aprovariam um banco que os serviços nunca usam.
  // `declarados[0]` já é absoluto e igual ao [1] — a checagem acima garante.
  process.env.DATABASE_PATH = declarados[0]

  authDb = getAuthDb()
  mcpDb = getMcpDb()
  const arquivoAuth = arquivoAberto(authDb)
  const arquivoMcp = arquivoAberto(mcpDb)

  console.log(`   api-auth   -> ${arquivoAuth}`)
  console.log(`   mcp-server -> ${arquivoMcp}`)

  if (resolve(arquivoAuth) !== resolve(arquivoMcp)) {
    falhar('As duas conexões abriram arquivos DIFERENTES, apesar do DATABASE_PATH bater.')
  }

  console.log('\n3. Escrita pelo api-auth, leitura pelo mcp-server\n')

  const escrito = `ok-${Date.now()}`
  authDb.exec(`CREATE TABLE IF NOT EXISTS ${TABELA} (marca TEXT NOT NULL)`)
  authDb.exec(`DELETE FROM ${TABELA}`)
  authDb.prepare(`INSERT INTO ${TABELA} (marca) VALUES (?)`).run(escrito)

  const lido = mcpDb.prepare(`SELECT marca FROM ${TABELA}`).get()?.marca
  if (lido !== escrito) {
    falhar(`O api-auth escreveu "${escrito}" mas o mcp-server leu "${lido}".`)
  }

  console.log(`   escrito: ${escrito}\n   lido:    ${lido}`)
  console.log('\n✔ Banco compartilhado OK.\n')
} catch (erro) {
  if (!(erro instanceof FalhaDeVerificacao)) throw erro
  console.error(`\n✖ ${erro.message}\n`)
  // exitCode em vez de exit(): process.exit() aborta na hora e o finally
  // abaixo não roda, deixando a tabela de verificação no banco.
  process.exitCode = 1
} finally {
  // Não deixa rastro: as tabelas de domínio são criadas pelas tasks #5/#7/#8,
  // e esta aqui é só de verificação.
  authDb?.exec(`DROP TABLE IF EXISTS ${TABELA}`)
  authDb?.close()
  mcpDb?.close()
}
