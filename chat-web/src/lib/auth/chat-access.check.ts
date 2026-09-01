import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyMcpConnectionFailure,
  hasBearerAuthorization,
} from './chat-access.ts'

test('reconhece somente Authorization Bearer com token', () => {
  assert.equal(hasBearerAuthorization('Bearer token-valido'), true)
  assert.equal(hasBearerAuthorization('bearer token-valido'), true)
  assert.equal(hasBearerAuthorization(null), false)
  assert.equal(hasBearerAuthorization(''), false)
  assert.equal(hasBearerAuthorization('Bearer '), false)
  assert.equal(hasBearerAuthorization('Basic token'), false)
})

test('propaga recusas de autenticação do MCP', () => {
  assert.deepEqual(classifyMcpConnectionFailure(401), {
    status: 401,
    error: 'unauthorized',
  })
  assert.deepEqual(classifyMcpConnectionFailure(403), {
    status: 403,
    error: 'unauthorized',
  })
})

test('falha fechado quando o MCP não consegue validar a sessão', () => {
  assert.deepEqual(classifyMcpConnectionFailure(undefined), {
    status: 503,
    error: 'authentication service unavailable',
  })
  assert.deepEqual(classifyMcpConnectionFailure(500), {
    status: 503,
    error: 'authentication service unavailable',
  })
})
