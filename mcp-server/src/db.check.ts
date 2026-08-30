import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { DEFAULT_DATABASE_PATH, resolveDatabasePath } from './db.ts'

const ROOT = resolve('/srv/mcp-server')

test('usa o caminho padrão quando DATABASE_PATH não está definida', () => {
  assert.equal(resolveDatabasePath(undefined, ROOT), resolve(ROOT, DEFAULT_DATABASE_PATH))
})

test('trata DATABASE_PATH vazia ou só com espaços como não definida', () => {
  assert.equal(resolveDatabasePath('', ROOT), resolve(ROOT, DEFAULT_DATABASE_PATH))
  assert.equal(resolveDatabasePath('   ', ROOT), resolve(ROOT, DEFAULT_DATABASE_PATH))
})

test('resolve caminho relativo contra a raiz do pacote, não contra o cwd', () => {
  const resolved = resolveDatabasePath('../data/app.db', ROOT)
  assert.equal(resolved, resolve(ROOT, '../data/app.db'))
  assert.notEqual(resolved, resolve(process.cwd(), '../data/app.db'))
})

test('respeita caminho absoluto sem prefixar a raiz do pacote', () => {
  const absolute = resolve('/tmp/outro.db')
  assert.equal(resolveDatabasePath(absolute, ROOT), absolute)
})

test('ignora espaços em volta do caminho informado', () => {
  assert.equal(resolveDatabasePath('  ../data/app.db  ', ROOT), resolve(ROOT, '../data/app.db'))
})
