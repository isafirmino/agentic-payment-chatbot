import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accumulateToolCallDeltas, finalizeToolCalls, streamOpenRouter, toOpenAIMessages } from './openrouter.ts'

test('tool call completo num chunk só', () => {
  const acc = new Map<number, { name: string; arguments: string }>()
  accumulateToolCallDeltas(acc, [
    { index: 0, id: 'call_1', function: { name: 'listar_catalogo', arguments: '{"categoria":"eletronicos"}' } },
  ])
  const calls = finalizeToolCalls(acc)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'listar_catalogo')
  assert.deepEqual(calls[0].function.arguments, { categoria: 'eletronicos' })
})

test('argumento fragmentado em 3 pedaços, nome só no primeiro delta', () => {
  const acc = new Map<number, { name: string; arguments: string }>()
  accumulateToolCallDeltas(acc, [{ index: 0, id: 'call_1', function: { name: 'registrar_intencao' } }])
  accumulateToolCallDeltas(acc, [{ index: 0, function: { arguments: '{"produto_id":"pr' } }])
  accumulateToolCallDeltas(acc, [{ index: 0, function: { arguments: 'od_003","quant' } }])
  accumulateToolCallDeltas(acc, [{ index: 0, function: { arguments: 'idade":2}' } }])
  const calls = finalizeToolCalls(acc)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'registrar_intencao')
  assert.deepEqual(calls[0].function.arguments, { produto_id: 'prod_003', quantidade: 2 })
})

test('duas tool calls no mesmo turno, deltas intercalados por índice', () => {
  const acc = new Map<number, { name: string; arguments: string }>()
  accumulateToolCallDeltas(acc, [
    { index: 0, function: { name: 'listar_catalogo', arguments: '{}' } },
    { index: 1, function: { name: 'registrar_intencao' } },
  ])
  accumulateToolCallDeltas(acc, [{ index: 1, function: { arguments: '{"produto_id":"prod_001","quantidade":1}' } }])
  const calls = finalizeToolCalls(acc)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].function.name, 'listar_catalogo')
  assert.equal(calls[1].function.name, 'registrar_intencao')
  assert.deepEqual(calls[1].function.arguments, { produto_id: 'prod_001', quantidade: 1 })
})

test('argumento inválido não quebra — vira objeto vazio', () => {
  const acc = new Map<number, { name: string; arguments: string }>()
  accumulateToolCallDeltas(acc, [{ index: 0, function: { name: 'listar_catalogo', arguments: '{not json' } }])
  const calls = finalizeToolCalls(acc)
  assert.deepEqual(calls[0].function.arguments, {})
})

test('pareamento posicional de tool_call_id: assistant com 2 tool_calls + 2 mensagens tool', () => {
  const out = toOpenAIMessages([
    { role: 'user', content: 'quero comprar 2 fones e ver o catálogo' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        { function: { name: 'listar_catalogo', arguments: {} } },
        { function: { name: 'registrar_intencao', arguments: { produto_id: 'prod_003', quantidade: 2 } } },
      ],
    },
    { role: 'tool', content: '{"produtos":[]}' },
    { role: 'tool', content: '{"intencao_id":"int_abc"}' },
  ])
  assert.equal(out[0].tool_call_id, undefined)
  assert.equal(out[1].tool_calls?.length, 2)
  const [id1, id2] = out[1].tool_calls!.map((c) => c.id)
  assert.notEqual(id1, id2)
  assert.equal(out[2].tool_call_id, id1)
  assert.equal(out[3].tool_call_id, id2)
  assert.equal(out[1].tool_calls![1].function.arguments, JSON.stringify({ produto_id: 'prod_003', quantidade: 2 }))
})

test('streamOpenRouter lança erro claro se OPENROUTER_API_KEY não estiver configurada', async () => {
  const original = process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_API_KEY
  try {
    const gen = streamOpenRouter([{ role: 'user', content: 'oi' }], undefined, new AbortController().signal)
    await assert.rejects(() => gen.next(), /OPENROUTER_API_KEY/)
  } finally {
    if (original !== undefined) process.env.OPENROUTER_API_KEY = original
  }
})
