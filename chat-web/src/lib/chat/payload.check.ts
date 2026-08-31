import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPayload, SYSTEM_PROMPT } from './payload.ts'
import type { Message } from '../llm/types.ts'

test('o prompt do sistema vem sempre em primeiro lugar', () => {
  assert.equal(buildPayload([], 'oi')[0], SYSTEM_PROMPT)
  assert.equal(buildPayload([{ role: 'user', content: 'a' }], 'b')[0].role, 'system')
})

test('conversa vazia produz só o prompt e a mensagem do usuário', () => {
  const payload = buildPayload([], 'o que vocês vendem?')
  assert.equal(payload.length, 2)
  assert.deepEqual(payload[1], { role: 'user', content: 'o que vocês vendem?' })
})

test('o histórico inteiro vai junto, na ordem original', () => {
  const history: Message[] = [
    { role: 'user', content: 'o que vocês vendem?' },
    { role: 'assistant', content: '', tool_calls: [{ function: { name: 'listar_catalogo', arguments: {} } }] },
    { role: 'tool', content: '{"produtos":[{"id":"prod_001"}]}' },
    { role: 'assistant', content: 'Temos o Fone Bluetooth.' },
  ]
  const payload = buildPayload(history, 'quero 2 desse')

  assert.equal(payload.length, history.length + 2)
  assert.deepEqual(payload.slice(1, -1), history)
})

test('a mensagem nova do usuário entra por último', () => {
  const history: Message[] = [{ role: 'assistant', content: 'Qual método de pagamento?' }]
  const payload = buildPayload(history, 'pix')
  assert.deepEqual(payload.at(-1), { role: 'user', content: 'pix' })
})

test('o histórico não é truncado conforme a conversa cresce', () => {
  // O desafio exige histórico completo a cada turno: nenhuma janela deslizante.
  const history: Message[] = Array.from({ length: 200 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `mensagem ${i}`,
  }))
  const payload = buildPayload(history, 'e agora?')

  assert.equal(payload.length, 202)
  assert.equal(payload[1].content, 'mensagem 0')
  assert.equal(payload.at(-2)?.content, 'mensagem 199')
})

test('buildPayload não muta o histórico recebido', () => {
  const history: Message[] = [{ role: 'user', content: 'oi' }]
  buildPayload(history, 'tudo bem?')
  assert.equal(history.length, 1)
})

test('o prompt cita as três tools reais e os dois métodos de pagamento', () => {
  for (const termo of ['listar_catalogo', 'registrar_intencao', 'realizar_compra', 'cartao', 'pix']) {
    assert.ok(SYSTEM_PROMPT.content.includes(termo), `prompt deveria citar ${termo}`)
  }
})

test('o prompt não cita mais as tools do workshop', () => {
  for (const antiga of ['get_time', 'list_items']) {
    assert.ok(!SYSTEM_PROMPT.content.includes(antiga), `prompt não deveria citar ${antiga}`)
  }
})

test('o prompt cobre o prazo da intenção e todos os erros esperados', () => {
  for (const termo of [
    'valido_por_minutos',
    'LIMITE_EXCEDIDO',
    'INTENCAO_EXPIRADA',
    'INTENCAO_JA_PAGA',
    'INTENCAO_INVALIDA',
    'METODO_INVALIDO',
    'PRODUTO_INEXISTENTE',
    'QUANTIDADE_INVALIDA',
    'ESTOQUE_INSUFICIENTE',
  ]) {
    assert.ok(SYSTEM_PROMPT.content.includes(termo), `prompt deveria instruir sobre ${termo}`)
  }
})
