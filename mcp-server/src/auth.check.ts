import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import {
  DEVELOPMENT_JWT_SECRET,
  resolveConversaId,
  resolveCpf,
  resolveJwtSecret,
  Unauthorized,
} from './auth.ts'

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

test('resolveConversaId aceita UUID v4 e normaliza para minúsculas', () => {
  const uuid = '3F1A9C2E-7B48-4D6A-9F01-2C5E8A4B7D13'
  assert.equal(resolveConversaId(uuid), uuid.toLowerCase())
  assert.equal(resolveConversaId(`  ${uuid.toLowerCase()}  `), uuid.toLowerCase())
})

test('resolveConversaId trata ausência como indefinido, não como erro', () => {
  // Ausente é permitido no handler porque o catálogo não exige conversa; quem
  // exige são as tools de intenção. Malformado é outra história.
  for (const header of [undefined, '', '   ']) {
    assert.equal(resolveConversaId(header), undefined)
  }
})

test('resolveConversaId recusa identificador malformado', () => {
  const invalidos = [
    'conversa-1',
    'nao-e-uuid',
    '3f1a9c2e7b484d6a9f012c5e8a4b7d13',
    '3f1a9c2e-7b48-1d6a-9f01-2c5e8a4b7d13',
    '3f1a9c2e-7b48-4d6a-cf01-2c5e8a4b7d13',
    '3f1a9c2e-7b48-4d6a-9f01-2c5e8a4b7d13-extra',
    'x'.repeat(500),
  ]
  for (const header of invalidos) {
    assert.throws(() => resolveConversaId(header), Unauthorized, `deveria recusar: ${header}`)
  }
})

test('resolveConversaId usa o primeiro valor quando o cabeçalho vem repetido', () => {
  const uuid = '3f1a9c2e-7b48-4d6a-9f01-2c5e8a4b7d13'
  assert.equal(resolveConversaId([uuid, 'conversa-2']), uuid)
})
