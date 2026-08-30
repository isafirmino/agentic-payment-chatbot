import type { Message, ProviderChunk, ProviderTool } from './types'

export async function isOllamaReachable(): Promise<boolean> {
  const url = process.env.OLLAMA_URL ?? 'http://localhost:11434'
  try {
    const res = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

export async function* streamOllama(
  convo: Message[],
  tools: ProviderTool[] | undefined,
  signal: AbortSignal,
): AsyncGenerator<ProviderChunk> {
  const url = process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:14b'

  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: convo, tools, stream: true }),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`ollama: ${res.status} ${await res.text()}`)
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      if (!part.trim()) continue
      yield JSON.parse(part) as ProviderChunk
    }
  }
}
