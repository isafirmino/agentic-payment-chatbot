import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import { DEVELOPMENT_JWT_SECRET, resolveCpf, resolveJwtSecret, Unauthorized } from './auth.ts'

test('resolveJwtSecret usa configuracao explicita e remove espacos', () => {
  assert.equal(resolveJwtSecret({ JWT_SECRET: ' segredo ' }), 'segredo')
})
test('resolveJwtSecret permite fallback fora de producao', () => {
  assert.equal(resolveJwtSecret({ NODE_ENV: 'development' }), DEVELOPMENT_JWT_SECRET)
  assert.equal(resolveJwtSecret({ NODE_ENV: 'test', JWT_SECRET: ' ' }), DEVELOPMENT_JWT_SECRET)
})

test('resolveJwtSecret exige segredo em producao', () => {
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET is required/)
})

test('resolveCpf extrai o CPF do subject de JWT HS256 valido', () => {
  const token = jwt.sign({}, 'segredo', { subject: '12345678900', algorithm: 'HS256' })
  assert.equal(resolveCpf(`Bearer ${token}`, 'segredo'), '12345678900')
})

test('resolveCpf recusa token ausente, invalido, sem subject ou com algoritmo diferente', () => {
  const invalidSignature = jwt.sign({}, 'outro-segredo', { subject: '123' })
  const missingSubject = jwt.sign({}, 'segredo')
  const wrongAlgorithm = jwt.sign({}, 'segredo', { subject: '123', algorithm: 'HS384' })

  assert.throws(() => resolveCpf(undefined, 'segredo'), Unauthorized)
  assert.throws(() => resolveCpf('Basic abc', 'segredo'), Unauthorized)
  assert.throws(() => resolveCpf(`Bearer ${invalidSignature}`, 'segredo'), Unauthorized)
  assert.throws(() => resolveCpf(`Bearer ${missingSubject}`, 'segredo'), Unauthorized)
  assert.throws(() => resolveCpf(`Bearer ${wrongAlgorithm}`, 'segredo'), Unauthorized)
})
