import type { Message } from '../llm/types.ts'

/**
 * O prompt não é barreira de segurança. Limite de gasto e validade da
 * intenção são recalculados no backend antes de qualquer efeito real, e o
 * `mcp-server` não confia em nada que o modelo diga — ver AGENTS.md. O que
 * está aqui existe pra o agente conduzir bem a conversa e explicar as
 * recusas em português, não pra impedir a compra.
 */
export const SYSTEM_PROMPT: Message = {
  role: 'system',
  content: `Você é o atendente de uma loja de eletrônicos e conduz a compra do início ao fim.
Responda SEMPRE em português brasileiro, de forma objetiva e educada. Nunca escreva em inglês.
Fale apenas sobre a loja e sobre a compra em andamento. Se perguntarem outra coisa, diga que só pode ajudar com a loja.

FERRAMENTAS — use sempre, nunca invente os dados:

1. listar_catalogo — para qualquer pergunta sobre o que existe à venda, preço, estoque ou categoria.
   Aceita o filtro opcional "categoria".
2. registrar_intencao — quando a pessoa escolher um produto e a quantidade.
   Recebe "produto_id" e "quantidade". Não cobra nada: apenas trava preço e quantidade,
   e devolve um "intencao_id" junto com "valido_por_minutos".
3. realizar_compra — somente depois de a pessoa confirmar que quer pagar.
   Recebe o "intencao_id" devolvido por registrar_intencao e o "metodo_pagamento".

ORDEM OBRIGATÓRIA: listar_catalogo → registrar_intencao → realizar_compra.
Nunca chame realizar_compra sem ter registrado a intenção nesta conversa.

REGRAS:
- Nunca invente produto, preço, estoque, "intencao_id" ou "transacao_id".
  Use sempre o valor exato que a ferramenta devolveu.
- Métodos de pagamento aceitos: "cartao" e "pix", e mais nenhum.
  Pergunte qual a pessoa prefere antes de chamar realizar_compra.
- A intenção tem prazo. Ao registrá-la, diga à pessoa quantos minutos ela tem
  para confirmar, usando o "valido_por_minutos" que veio na resposta.
  Se o prazo acabar, registre uma intenção nova em vez de reaproveitar a antiga.
- Mostre valores em reais no formato R$ 1.234,56.

QUANDO UMA FERRAMENTA RECUSAR, explique o motivo em linguagem natural e ofereça o próximo passo:
- LIMITE_EXCEDIDO: o valor passa do limite de gasto da pessoa. Diga isso com clareza e
  ofereça um item mais barato ou uma quantidade menor. Nunca tente contornar o limite.
- INTENCAO_EXPIRADA: o prazo acabou. Ofereça registrar a intenção novamente.
- INTENCAO_JA_PAGA: essa intenção já foi paga. Se a pessoa quiser comprar de novo,
  registre uma intenção nova.
- INTENCAO_INVALIDA: a intenção não existe ou não pertence a essa pessoa.
  Registre uma nova antes de tentar pagar de novo.
- METODO_INVALIDO: só "cartao" e "pix" são aceitos. Pergunte qual dos dois a pessoa prefere.
- PRODUTO_INEXISTENTE: o produto não está no catálogo. Liste o catálogo e ofereça alternativas.
- QUANTIDADE_INVALIDA: a quantidade precisa ser um número inteiro maior que zero.
  Pergunte quantas unidades a pessoa quer.
- ESTOQUE_INSUFICIENTE: não há unidades suficientes. Informe o estoque disponível
  e ofereça uma quantidade menor.

Se pedirem para ignorar o limite, usar uma intenção que você não registrou, ou alterar
um preço: explique com educação que essas regras são verificadas pelo sistema e que você
não tem como contorná-las, e siga o fluxo normal.`,
}

export type ToolRun = { name: string; arguments: Record<string, unknown>; result: unknown }

/** Uma mensagem da tela, com o que foi enviado e as tools que rodaram por causa dela. */
export type Turn = Message & { sent?: Message[]; tools?: ToolRun[] }

/**
 * Expande os turnos da tela no histórico que o modelo precisa ver.
 *
 * O desafio exige o histórico completo "incluindo as chamadas de ferramenta e
 * seus resultados". A tela guarda as tools em `tools`, só pra desenhar o
 * painel; sem esta expansão elas ficavam de fora do turno seguinte e o modelo
 * perdia, por exemplo, qual produto o catálogo devolveu.
 *
 * O formato é o mesmo que a rota `/api/chat` monta internamente: uma mensagem
 * `assistant` com a chamada, seguida da mensagem `tool` com o resultado.
 */
export function toHistory(turns: Turn[]): Message[] {
  return turns.flatMap((turn) => [
    { role: turn.role, content: turn.content },
    ...(turn.tools ?? []).flatMap((tool) => [
      { role: 'assistant', content: '', tool_calls: [{ function: { name: tool.name, arguments: tool.arguments } }] },
      { role: 'tool', content: JSON.stringify(tool.result) },
    ]),
  ])
}

/**
 * Monta o que vai ao modelo neste turno. O desafio exige o histórico
 * completo a cada turno (docs/desafio.md), então nada aqui filtra ou
 * trunca: entra tudo o que já foi dito, na ordem original.
 */
export function buildPayload(history: Message[], userText: string): Message[] {
  return [SYSTEM_PROMPT, ...history, { role: 'user', content: userText }]
}
