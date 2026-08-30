import type { Message, ProviderChunk, ProviderTool, ToolCall } from './types'

type OpenAIToolCallDelta = {
  index: number
  id?: string
  function?: { name?: string; arguments?: string }
}

type OpenAIChunk = {
  choices?: Array<{
    delta?: { content?: string; tool_calls?: OpenAIToolCallDelta[] }
    finish_reason?: string | null
  }>
}

type OpenAIMessage = {
  role: string
  content: string
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

/** Acumula os fragmentos de tool_calls que chegam espalhados entre vários chunks do SSE, por índice. */
export function accumulateToolCallDeltas(
  acc: Map<number, { name: string; arguments: string }>,
  deltas: OpenAIToolCallDelta[],
): void {
  for (const d of deltas) {
    const entry = acc.get(d.index) ?? { name: '', arguments: '' }
    if (d.function?.name) entry.name = d.function.name
    if (d.function?.arguments) entry.arguments += d.function.arguments
    acc.set(d.index, entry)
  }
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Converte o acumulado final num ToolCall[] no formato compartilhado (arguments já
 * como objeto), ordenado pelo índice do delta — não pela ordem de inserção no Map,
 * que pode não bater se os chunks chegarem fora de ordem.
 */
export function finalizeToolCalls(acc: Map<number, { name: string; arguments: string }>): ToolCall[] {
  return [...acc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, c]) => ({ function: { name: c.name, arguments: safeParseArgs(c.arguments) } }))
}

/**
 * Converte o histórico compartilhado (Message[]) pro formato OpenAI-compatible.
 * tool_call_id é sintetizado por posição: cada mensagem assistant com tool_calls
 * gera ids `call_<msgIndex>_<callIndex>`, e as N mensagens `role: 'tool'` seguintes
 * (na mesma ordem em que route.ts as insere) recebem o id correspondente.
 */
export function toOpenAIMessages(convo: Message[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = []
  let pendingToolIds: string[] = []

  convo.forEach((msg, msgIndex) => {
    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      const ids = msg.tool_calls.map((_, callIndex) => `call_${msgIndex}_${callIndex}`)
      pendingToolIds = [...ids]
      out.push({
        role: 'assistant',
        content: msg.content,
        tool_calls: msg.tool_calls.map((call, i) => ({
          id: ids[i],
          type: 'function',
          function: { name: call.function.name, arguments: JSON.stringify(call.function.arguments) },
        })),
      })
      return
    }
    if (msg.role === 'tool' && pendingToolIds.length > 0) {
      out.push({ role: 'tool', content: msg.content, tool_call_id: pendingToolIds.shift() })
      return
    }
    out.push({ role: msg.role, content: msg.content })
  })

  return out
}

export async function* streamOpenRouter(
  convo: Message[],
  tools: ProviderTool[] | undefined,
  signal: AbortSignal,
): AsyncGenerator<ProviderChunk> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY não configurada em .env — necessária pro fallback quando o Ollama não está acessível.',
    )
  }
  const url = process.env.OPENROUTER_URL ?? 'https://openrouter.ai/api/v1/chat/completions'
  const model = process.env.OPENROUTER_MODEL ?? 'openrouter/free'

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: toOpenAIMessages(convo), tools, stream: true }),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`openrouter: ${res.status} ${await res.text()}`)
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  const toolCallAcc = new Map<number, { name: string; arguments: string }>()
  let sawToolCalls = false

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice('data:'.length).trim()
      if (!payload || payload === '[DONE]') continue
      const chunk = JSON.parse(payload) as OpenAIChunk
      const delta = chunk.choices?.[0]?.delta
      if (delta?.content) yield { message: { content: delta.content } }
      if (delta?.tool_calls) {
        sawToolCalls = true
        accumulateToolCallDeltas(toolCallAcc, delta.tool_calls)
      }
    }
  }

  if (sawToolCalls) yield { message: { tool_calls: finalizeToolCalls(toolCallAcc) } }
}
