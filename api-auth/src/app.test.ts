import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import {
  app,
  DEFAULT_LIMIT_CENTS,
  DEVELOPMENT_JWT_SECRET,
  initSchema,
  resolveDefaultLimit,
  resolveJwtSecret,
} from './app.ts'
import { getDb } from './db.ts'
import jwt from 'jsonwebtoken'

process.env.DATABASE_PATH = ':memory:'

let server: ReturnType<typeof createServer>
let serverUrl: string

async function setupServer(): Promise<void> {
  const db = getDb()
  db.exec('DROP TABLE IF EXISTS usuarios')
  initSchema()

  server = createServer(app)
  return new Promise((resolve) => {
    server.listen(0, 'localhost', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        serverUrl = `http://localhost:${addr.port}`
      }
      resolve()
    })
  })
}

async function teardownServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

type ResponseBody = Record<string, string | number>

async function request(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<{ status: number; body: ResponseBody }> {
  const url = new URL(path, serverUrl)
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  const res = await fetch(url, {
    ...opts,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await res.text()
  return {
    status: res.status,
    body: text ? (JSON.parse(text) as ResponseBody) : {},
  }
}

test('Configuração', () => {
  assert.equal(resolveDefaultLimit(undefined), DEFAULT_LIMIT_CENTS)
  assert.equal(resolveDefaultLimit(''), DEFAULT_LIMIT_CENTS)
  assert.equal(resolveDefaultLimit('0'), 0)
  assert.equal(resolveDefaultLimit('25000'), 25000)
  assert.throws(() => resolveDefaultLimit('-1'), /non-negative integer/)
  assert.throws(() => resolveDefaultLimit('1.5'), /non-negative integer/)
  assert.throws(() => resolveDefaultLimit('invalido'), /non-negative integer/)

  assert.equal(
    resolveJwtSecret({ NODE_ENV: 'development' }),
    DEVELOPMENT_JWT_SECRET,
  )
  assert.equal(
    resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: ' segredo ' }),
    'segredo',
  )
  assert.throws(
    () => resolveJwtSecret({ NODE_ENV: 'production' }),
    /JWT_SECRET is required/,
  )
})

test('Cadastro', async (t) => {
  await setupServer()

  await t.test('novo usuário com CPF válido', async () => {
    const res = await request('POST', '/auth/cadastro', {
      nome: 'Alice',
      cpf: '12345678901',
      senha: 'senha123',
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.message, 'cadastro realizado')
  })

  await t.test('rejeita CPF duplicado', async () => {
    await request('POST', '/auth/cadastro', {
      nome: 'Alice',
      cpf: '12345678901',
      senha: 'senha123',
    })
    const res = await request('POST', '/auth/cadastro', {
      nome: 'Bob',
      cpf: '12345678901',
      senha: 'outraSenha',
    })
    assert.equal(res.status, 400)
    assert.match(String(res.body.error), /CPF já cadastrado/)
  })

  await t.test('rejeita nome vazio', async () => {
    const res = await request('POST', '/auth/cadastro', {
      nome: '',
      cpf: '12345678902',
      senha: 'senha123',
    })
    assert.equal(res.status, 400)
  })

  await t.test('rejeita CPF vazio', async () => {
    const res = await request('POST', '/auth/cadastro', {
      nome: 'Alice',
      cpf: '',
      senha: 'senha123',
    })
    assert.equal(res.status, 400)
  })

  await t.test('rejeita senha vazia', async () => {
    const res = await request('POST', '/auth/cadastro', {
      nome: 'Alice',
      cpf: '12345678903',
      senha: '',
    })
    assert.equal(res.status, 400)
  })

  await teardownServer()
})

test('Login', async (t) => {
  await setupServer()

  await t.test('com credenciais corretas', async () => {
    await request('POST', '/auth/cadastro', {
      nome: 'Alice',
      cpf: '12345678901',
      senha: 'senha123',
    })

    const res = await request('POST', '/auth/login', {
      cpf: '12345678901',
      senha: 'senha123',
    })

    assert.equal(res.status, 200)
    assert.equal(typeof res.body.token, 'string')
    assert.equal(res.body.cpf, '12345678901')
    assert.equal(res.body.nome, 'Alice')
    assert.equal(res.body.expiresIn, '1h')

    // Valida JWT
    const JWT_SECRET = resolveJwtSecret()
    const decoded = jwt.verify(
      String(res.body.token),
      JWT_SECRET,
    ) as jwt.JwtPayload
    assert.equal(decoded.sub, '12345678901')
    assert.equal(decoded.role, undefined) // sem role
    assert.equal(decoded.limite_cents, undefined) // sem limite no payload
  })

  await t.test('rejeita CPF inexistente', async () => {
    const res = await request('POST', '/auth/login', {
      cpf: 'naoexiste',
      senha: 'qualquer',
    })
    assert.equal(res.status, 401)
    assert.match(String(res.body.error), /CPF ou senha inválidos/)
  })

  await t.test('rejeita senha errada', async () => {
    await request('POST', '/auth/cadastro', {
      nome: 'Alice',
      cpf: '12345678902',
      senha: 'senha123',
    })

    const res = await request('POST', '/auth/login', {
      cpf: '12345678902',
      senha: 'senhaErrada',
    })
    assert.equal(res.status, 401)
    assert.match(String(res.body.error), /CPF ou senha inválidos/)
  })

  await t.test('rejeita CPF/senha vazio', async () => {
    const res = await request('POST', '/auth/login', {
      cpf: '',
      senha: '',
    })
    assert.equal(res.status, 401)
  })

  await teardownServer()
})

test('GET /usuarios/me/limite', async (t) => {
  await setupServer()

  await t.test('retorna limite com JWT válido', async () => {
    await request('POST', '/auth/cadastro', {
      nome: 'Alice',
      cpf: '12345678901',
      senha: 'senha123',
    })

    const loginRes = await request('POST', '/auth/login', {
      cpf: '12345678901',
      senha: 'senha123',
    })

    const res = await request('GET', '/usuarios/me/limite', undefined, {
      Authorization: `Bearer ${loginRes.body.token}`,
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.limite_cents, 100000)
  })

  await t.test('rejeita sem JWT', async () => {
    const res = await request('GET', '/usuarios/me/limite')
    assert.equal(res.status, 401)
  })

  await t.test('rejeita JWT inválido', async () => {
    const res = await request('GET', '/usuarios/me/limite', undefined, {
      Authorization: 'Bearer token_invalido',
    })
    assert.equal(res.status, 401)
  })

  await t.test('rejeita JWT expirado', async () => {
    const expiredToken = jwt.sign({}, resolveJwtSecret(), {
      subject: '12345678901',
      expiresIn: -1,
    })
    const res = await request('GET', '/usuarios/me/limite', undefined, {
      Authorization: `Bearer ${expiredToken}`,
    })
    assert.equal(res.status, 401)
  })

  await t.test('rejeita JWT sem subject', async () => {
    const tokenWithoutSubject = jwt.sign({}, resolveJwtSecret(), {
      expiresIn: '1h',
    })
    const res = await request('GET', '/usuarios/me/limite', undefined, {
      Authorization: `Bearer ${tokenWithoutSubject}`,
    })
    assert.equal(res.status, 401)
  })

  await t.test('rejeita JWT de usuário inexistente', async () => {
    const JWT_SECRET = resolveJwtSecret()
    const fakeToken = jwt.sign({}, JWT_SECRET, {
      subject: 'cpf_inexistente',
      expiresIn: '1h',
    })

    const res = await request('GET', '/usuarios/me/limite', undefined, {
      Authorization: `Bearer ${fakeToken}`,
    })

    assert.equal(res.status, 404)
  })

  await teardownServer()
})

test('CORS', async () => {
  await setupServer()

  const res = await fetch(new URL('/auth/login', serverUrl), {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })

  assert.equal(res.status, 204)
  assert.equal(
    res.headers.get('access-control-allow-origin'),
    'http://localhost:3000',
  )

  await teardownServer()
})

test('Health check', async (t) => {
  await setupServer()

  await t.test('retorna status ok', async () => {
    const res = await request('GET', '/health')
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'ok')
  })

  await teardownServer()
})
