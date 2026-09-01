export const AUTH_MESSAGE_KEY = 'auth_message'

export type ChatSession = {
  token: string
  cpf: string
  nome: string
}

export function parseChatSession(raw: string | null): ChatSession | undefined {
  if (!raw) return undefined

  try {
    const value = JSON.parse(raw) as Partial<ChatSession>
    if (
      typeof value.token !== 'string' ||
      !value.token.trim() ||
      typeof value.cpf !== 'string' ||
      !value.cpf.trim() ||
      typeof value.nome !== 'string' ||
      !value.nome.trim()
    ) {
      return undefined
    }

    return { token: value.token, cpf: value.cpf, nome: value.nome }
  } catch {
    return undefined
  }
}
