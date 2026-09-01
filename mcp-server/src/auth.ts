import jwt from 'jsonwebtoken'

export const DEVELOPMENT_JWT_SECRET = 'workshop-dev-secret-do-not-use-in-prod'

export class Unauthorized extends Error {}

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.JWT_SECRET?.trim()
  if (configured) return configured
  if (env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required when NODE_ENV=production')
  }
  return DEVELOPMENT_JWT_SECRET
}
export const CONVERSA_HEADER = 'x-conversa-id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Lê o identificador de conversa do cabeçalho. Devolve undefined quando não
 * vem — quem exige (as tools de intenção) trata a ausência; o catálogo não.
 *
 * O formato é validado porque isto é entrada não confiável: sem a checagem,
 * qualquer string vira uma "conversa" válida, inclusive uma previsível como
 * "conversa-1" que outro cliente poderia adivinhar, ou uma longa o bastante
 * pra sujar o banco. Ver ADR 0007.
 */
export function resolveConversaId(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (!UUID_V4.test(trimmed)) {
    throw new Unauthorized('conversation id must be a v4 UUID')
  }
  return trimmed.toLowerCase()
}

export function resolveCpf(authorization: string | undefined, secret: string): string {
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new Unauthorized('missing bearer token')

  try {
    const claims = jwt.verify(match[1].trim(), secret, { algorithms: ['HS256'] }) as jwt.JwtPayload
    if (typeof claims.sub !== 'string' || !claims.sub.trim()) {
      throw new Unauthorized('token subject is missing')
    }
    return claims.sub
  } catch (error) {
    if (error instanceof Unauthorized) throw error
    throw new Unauthorized('invalid or expired token')
  }
}
