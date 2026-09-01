export type ChatAccessFailure = {
  status: 401 | 403 | 503
  error: 'unauthorized' | 'authentication service unavailable'
}

export function hasBearerAuthorization(
  header: string | null,
): header is string {
  return typeof header === 'string' && /^Bearer\s+\S+\s*$/i.test(header)
}

export function classifyMcpConnectionFailure(
  code: number | undefined,
): ChatAccessFailure {
  if (code === 401 || code === 403) {
    return { status: code, error: 'unauthorized' }
  }

  return { status: 503, error: 'authentication service unavailable' }
}
