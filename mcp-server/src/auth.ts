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
