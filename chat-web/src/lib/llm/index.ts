import { isOllamaReachable, streamOllama } from './ollama.ts'
import { streamOpenRouter } from './openrouter.ts'
import type { StreamFn } from './types'

let cached: StreamFn | undefined

/**
 * Decide qual provedor usar (Ollama se acessível, senão OpenRouter) uma única
 * vez por processo do servidor e cacheia o resultado — ver ADR 0002.
 */
export async function pickProvider(): Promise<StreamFn> {
  if (!cached) {
    cached = (await isOllamaReachable()) ? streamOllama : streamOpenRouter
  }
  return cached
}
