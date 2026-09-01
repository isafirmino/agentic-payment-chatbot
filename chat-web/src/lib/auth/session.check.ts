import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseChatSession } from './session.ts'

test('aceita sessão completa', () => {
  assert.deepEqual(
    parseChatSession(
      JSON.stringify({ token: 'jwt', cpf: '12345678900', nome: 'Alice' }),
    ),
    { token: 'jwt', cpf: '12345678900', nome: 'Alice' },
  )
})

test('recusa sessão ausente, inválida ou incompleta', () => {
  assert.equal(parseChatSession(null), undefined)
  assert.equal(parseChatSession('{'), undefined)
  assert.equal(parseChatSession(JSON.stringify({ token: 'jwt' })), undefined)
  assert.equal(
    parseChatSession(
      JSON.stringify({ token: ' ', cpf: '12345678900', nome: 'Alice' }),
    ),
    undefined,
  )
})
