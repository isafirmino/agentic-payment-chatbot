import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const DEFAULT_DATABASE_PATH = '../data/app.db'

const PACKAGE_ROOT = join(import.meta.dirname, '..')

/**
 * Resolve contra a raiz do pacote, nunca contra o cwd: rodar o serviço a
 * partir da raiz do repo apontaria pra outro arquivo, e o SQLite cria um
 * banco vazio em vez de reclamar — `api-auth` e `mcp-server` passariam a usar
 * bancos diferentes sem nenhum erro visível. Ver ADR 0003.
 */
export function resolveDatabasePath(
  raw: string | undefined,
  packageRoot: string,
): string {
  const value = raw?.trim() ? raw.trim() : DEFAULT_DATABASE_PATH
  // :memory: é um identificador especial do SQLite, não um caminho de arquivo
  if (value === ':memory:') {
    return value
  }
  return resolve(packageRoot, value)
}

let connection: DatabaseSync | undefined

/**
 * Abre na primeira chamada e reaproveita depois. Não abre na importação do
 * módulo pra que um teste possa importar daqui sem criar arquivo no disco.
 */
export function getDb(): DatabaseSync {
  if (!connection) {
    const path = resolveDatabasePath(process.env.DATABASE_PATH, PACKAGE_ROOT)
    mkdirSync(dirname(path), { recursive: true })
    connection = new DatabaseSync(path)
    // WAL e busy_timeout porque api-auth e mcp-server são processos separados
    // no mesmo arquivo. foreign_keys vale por conexão e vem desligado por
    // padrão no SQLite, então precisa ser ligado aqui e não no schema — sem
    // isso os REFERENCES das tabelas não são verificados por nada.
    connection.exec('PRAGMA journal_mode = WAL')
    connection.exec('PRAGMA busy_timeout = 5000')
    connection.exec('PRAGMA foreign_keys = ON')
  }
  return connection
}
