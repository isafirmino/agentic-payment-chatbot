// Relatório de auditoria das compras aprovadas (extra do desafio: "quem,
// quando, quanto, resultado").
//
// A tabela `transacoes` (task #8) já é o log auditável — este script só a
// torna legível sem exigir um cliente SQLite instalado na máquina, o que não
// é garantido em nenhum ambiente onde a entrega vai ser avaliada.
//
// Para cada usuário: limite cadastrado, total já gasto, saldo restante e a
// lista de compras. O saldo é calculado com a MESMA expressão que o backend
// usa em realizarCompra (mcp-server/src/tools.ts) — limite_cents menos a soma
// de valor_cents do CPF. Reimplementar a regra aqui criaria uma segunda fonte
// de verdade, e um relatório de auditoria que diverge do sistema auditado é
// pior que nenhum relatório.
//
// Uso: node scripts/consultar-transacoes.mjs

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { resolveDatabasePath } from '../mcp-server/src/db.ts'

const RAIZ_REPO = join(import.meta.dirname, '..')
const PACOTE = 'mcp-server'

class FalhaDeConsulta extends Error {}

/**
 * Lê DATABASE_PATH do .env do mcp-server.
 *
 * Feito na mão, e não pelo dotenv, porque este script roda a partir da raiz
 * do repo: o `dotenv/config` carrega o .env do diretório de execução, nunca o
 * de dentro do serviço. Sem isto, um DATABASE_PATH customizado seria ignorado
 * e o relatório leria um banco que ninguém usa. Mesmo motivo documentado em
 * scripts/verify-shared-db.mjs.
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

const real = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const dataHora = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}

/** Confere que a tabela existe antes de consultar, pra dar erro explicativo. */
function exigirTabela(db, tabela, comoResolver) {
  const existe = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(tabela)
  if (!existe) {
    throw new FalhaDeConsulta(
      `A tabela \`${tabela}\` não existe neste banco.\n  ${comoResolver}`,
    )
  }
}

let db

try {
  const caminho = resolveDatabasePath(
    process.env.DATABASE_PATH ?? databasePathDeclarado(),
    join(RAIZ_REPO, PACOTE),
  )

  // Abre direto em vez de usar getDb(): o getDb cria o diretório e o SQLite
  // cria um arquivo vazio se ele não existir, então um caminho errado viraria
  // um relatório "nenhuma compra registrada" em vez de um erro. Aqui um banco
  // inexistente precisa ser dito em voz alta.
  if (!existsSync(caminho)) {
    throw new FalhaDeConsulta(
      `Banco não encontrado em ${caminho}\n` +
        '  Suba o api-auth e o mcp-server ao menos uma vez pra que ele seja criado.',
    )
  }

  // readOnly porque isto é auditoria: um relatório não deve ser capaz de
  // alterar aquilo que audita, nem mesmo por engano.
  db = new DatabaseSync(caminho, { readOnly: true })
  db.exec('PRAGMA busy_timeout = 5000')

  exigirTabela(db, 'usuarios', 'Suba o api-auth ao menos uma vez (ele cria essa tabela).')
  exigirTabela(db, 'transacoes', 'Suba o mcp-server ao menos uma vez (ele cria essa tabela).')

  console.log(`\nLog auditável de compras — ${caminho}\n`)

  // Mesma expressão de realizarCompra: limite_cents - SUM(valor_cents).
  // LEFT JOIN pra que um usuário sem nenhuma compra apareça com saldo cheio,
  // em vez de sumir do relatório.
  const usuarios = db
    .prepare(
      `SELECT u.cpf, u.nome, u.limite_cents,
              COALESCE(SUM(t.valor_cents), 0) AS total_cents,
              COUNT(t.id) AS compras
       FROM usuarios u
       LEFT JOIN transacoes t ON t.owner_cpf = u.cpf
       GROUP BY u.cpf, u.nome, u.limite_cents
       ORDER BY u.nome`,
    )
    .all()

  if (usuarios.length === 0) {
    console.log('  Nenhum usuário cadastrado ainda.\n')
  }

  const compras = db.prepare(
    `SELECT t.id, t.data, t.valor_cents, t.metodo_pagamento, t.intencao_id,
            i.quantidade, p.nome AS produto
     FROM transacoes t
     JOIN intencoes i ON i.id = t.intencao_id
     JOIN produtos p ON p.id = i.produto_id
     WHERE t.owner_cpf = ?
     ORDER BY t.data`,
  )

  for (const usuario of usuarios) {
    const restante = usuario.limite_cents - usuario.total_cents

    console.log(`${usuario.nome}  (CPF ${usuario.cpf})`)
    console.log(`  limite ${real(usuario.limite_cents)}`)
    console.log(`  gasto  ${real(usuario.total_cents)} em ${usuario.compras} compra(s)`)
    console.log(`  saldo  ${real(restante)}\n`)

    const linhas = compras.all(usuario.cpf)
    if (linhas.length === 0) {
      console.log('    (nenhuma compra aprovada)\n')
      continue
    }

    for (const linha of linhas) {
      console.log(
        `    ${dataHora(linha.data)}  ${linha.produto} x${linha.quantidade}` +
          `  ${real(linha.valor_cents)}  ${linha.metodo_pagamento}`,
      )
      console.log(`      ${linha.id}  <-  ${linha.intencao_id}`)
    }
    console.log()
  }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM transacoes`).get().n
  console.log(`${total} transação(ões) registrada(s) no total.\n`)
} catch (erro) {
  if (!(erro instanceof FalhaDeConsulta)) throw erro
  console.error(`\n✖ ${erro.message}\n`)
  // exitCode em vez de exit(): process.exit() aborta na hora e o finally
  // abaixo não roda, deixando a conexão aberta.
  process.exitCode = 1
} finally {
  db?.close()
}
