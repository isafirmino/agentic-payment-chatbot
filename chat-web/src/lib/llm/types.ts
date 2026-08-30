export type ToolCall = { function: { name: string; arguments: Record<string, unknown> } }
export type Message = { role: string; content: string; tool_calls?: ToolCall[] }
export type ProviderChunk = { message?: { content?: string; tool_calls?: ToolCall[] } }
export type ProviderTool = { type: 'function'; function: { name: string; description: string; parameters: unknown } }
export type StreamFn = (
  convo: Message[],
  tools: ProviderTool[] | undefined,
  signal: AbortSignal,
) => AsyncGenerator<ProviderChunk>
