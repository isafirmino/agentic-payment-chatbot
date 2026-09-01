import type { DatabaseSync } from 'node:sqlite'

/**
 * Registro de chamadas de tool. Vive fora de `tools.ts` porque não é regra de
 * negócio: nada aqui decide se uma compra acontece.
 *
 * A gravação é feita DEPOIS que a tool retorna e FORA de qualquer transação de
 * negócio. Essa é a decisão que faz o log valer: uma compra recusada reverte
 * tudo o que tocou, e um registro gravado por dentro sumiria no `ROLLBACK`
 * junto com a tentativa que ele deveria documentar. Ver ADR 0008.
 */

const CATALOGO = 'listar_catalogo'

/**
 * Rótulo curto do que aconteceu, para dar pra filtrar o log sem ler o JSON.
 *
 * Uma recusa tem `erro`; uma aprovação tem `status`. O catálogo não tem
 * nenhum dos dois — listar é sempre "deu certo" —, então recebe rótulo fixo.
 */
export function resolveDesfecho(tool: string, resultado: unknown): string {
  if (tool === CATALOGO) return 'consultado'
  if (typeof resultado !== 'object' || resultado === null) return 'desconhecido'
  const registro = resultado as Record<string, unknown>
  if (typeof registro.erro === 'string') return registro.erro
  if (typeof registro.status === 'string') return registro.status
  return 'desconhecido'
}

/**
 * O catálogo devolve os cinco produtos inteiros. Gravar isso a cada consulta
 * repetiria o mesmo bloco em toda linha sem acrescentar informação — a decisão
 * ali é sempre "listei o que existe". As tools de intenção são o oposto: o
 * corpo carrega identificador, valor calculado e código de recusa, que é a
 * evidência toda.
 */
export function resumirResultado(tool: string, resultado: unknown): string {
  if (tool !== CATALOGO) return JSON.stringify(resultado ?? null)
  const produtos = (resultado as { produtos?: unknown[] } | null)?.produtos
  return JSON.stringify({ produtos: Array.isArray(produtos) ? produtos.length : 0 })
}

/**
 * Grava uma chamada. NUNCA lança.
 *
 * Quando este código roda, a tool já terminou — uma compra aprovada já fez
 * `COMMIT` e já foi confirmada ao usuário. Propagar uma falha de escrita aqui
 * transformaria um problema de auditoria em perda de compra, sem sequer
 * conseguir desfazer o que já aconteceu. A falha vai para a saída de erro e o
 * chamador segue. É limitação consciente, registrada no ADR 0008.
 */
export function registrarChamada(
  db: DatabaseSync,
  entrada: { tool: string; ownerCpf: string; argumentos: unknown; resultado: unknown },
  now = new Date(),
): void {
  try {
    db.prepare(
      `INSERT INTO chamadas_tool (tool, owner_cpf, argumentos, resultado, desfecho, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      entrada.tool,
      entrada.ownerCpf,
      JSON.stringify(entrada.argumentos ?? {}),
      resumirResultado(entrada.tool, entrada.resultado),
      resolveDesfecho(entrada.tool, entrada.resultado),
      now.toISOString(),
    )
  } catch (erro) {
    console.error(`[auditoria] falha ao registrar ${entrada.tool}:`, erro)
  }
}
