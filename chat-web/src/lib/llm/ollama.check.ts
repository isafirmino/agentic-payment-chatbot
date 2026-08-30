import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOllamaReachable, streamOllama } from './ollama.ts'

function withFetch<T>(fake: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = fake
  return run().finally(() => {
    globalThis.fetch = original
  })
}

test('isOllamaReachable retorna true quando /api/version responde ok', async () => {
  const result = await withFetch(
    (async () => new Response(null, { status: 200 })) as typeof fetch,
    () => isOllamaReachable(),
  )
  assert.equal(result, true)
})

test('isOllamaReachable retorna false quando o fetch falha (Ollama fora do ar)', async () => {
  const result = await withFetch(
    (async () => {
      throw new Error('connection refused')
    }) as typeof fetch,
    () => isOllamaReachable(),
  )
  assert.equal(result, false)
})

test('streamOllama faz parse do NDJSON, mesmo com linha fragmentada entre leituras', async () => {
  const chunks = await withFetch(
    (async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"message":{"content":"oi'))
          controller.enqueue(new TextEncoder().encode('!"}}\n{"message":{"tool_calls":[]}}\n'))
          controller.close()
        },
      })
      return new Response(body, { status: 200 })
    }) as typeof fetch,
    async () => {
      const out = []
      for await (const chunk of streamOllama(
        [{ role: 'user', content: 'oi' }],
        undefined,
        new AbortController().signal,
      )) {
        out.push(chunk)
      }
      return out
    },
  )
  assert.equal(chunks.length, 2)
  assert.equal(chunks[0].message?.content, 'oi!')
  assert.deepEqual(chunks[1].message?.tool_calls, [])
})

test('streamOllama lança erro quando a resposta não é ok', async () => {
  await assert.rejects(
    () =>
      withFetch(
        (async () => new Response('deu ruim', { status: 500 })) as typeof fetch,
        async () => {
          const gen = streamOllama([{ role: 'user', content: 'oi' }], undefined, new AbortController().signal)
          await gen.next()
        },
      ),
    /ollama: 500/,
  )
})
