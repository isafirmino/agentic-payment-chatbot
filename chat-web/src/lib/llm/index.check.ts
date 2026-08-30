import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streamOllama } from './ollama.ts'
import { pickProvider } from './index.ts'
import { streamOpenRouter } from './openrouter.ts'

test('pickProvider escolhe entre streamOllama e streamOpenRouter, e cacheia a escolha', async () => {
  const first = await pickProvider()
  assert.ok(first === streamOllama || first === streamOpenRouter)

  const second = await pickProvider()
  assert.equal(second, first, 'segunda chamada deve reusar o mesmo provedor, sem checar o Ollama de novo')
})
