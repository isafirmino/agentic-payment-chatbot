# 0008 — Registrar chamadas de tool fora da transação de negócio

Status: aceita

## Contexto

O `docs/desafio.md` pede, entre os extras opcionais, "log auditável de cada
chamada de tool (quem, quando, quanto, resultado)". A tabela `transacoes`
cobria só as compras **aprovadas** — decisão explícita da task #8
(`specs/006-purchase-payment/spec.md`, "Fora de escopo").

O que ficava de fora é o que uma auditoria mais quer ver: as tentativas
**recusadas**. `LIMITE_EXCEDIDO`, `INTENCAO_INVALIDA`, `INTENCAO_JA_PAGA` e as
demais existiam apenas no painel do `chat-web`, que vive na memória da aba e
desaparece ao recarregar a página. Terminada a conversa, não sobrava evidência
de que a tentativa existiu.

A restrição que molda a decisão é o `realizar_compra`: ele roda tudo sob
`BEGIN IMMEDIATE` e, em qualquer recusa, faz `ROLLBACK` de todos os efeitos.

## Decisão

O registro acontece num **envelope em volta das tools**, aplicado no ponto em
que elas são declaradas, e grava **depois** que a tool retorna, **fora** de
qualquer transação de negócio.

Três consequências fazem parte da decisão:

- **Só é registrada a chamada que chega a executar.** Uma chamada barrada pela
  validação de schema ou pela autenticação não é registrada.
- **Uma falha ao gravar o log não derruba a chamada.** A falha vai para a saída
  de erro do processo e a tool devolve seu resultado normalmente.
- **O resultado é gravado por inteiro nas tools de intenção e resumido no
  catálogo**, onde o corpo é sempre a mesma lista.

## Alternativas consideradas

- **Gravar dentro da transação da compra** — seria atômico com o efeito, e é a
  escolha mais natural à primeira vista. É também a pior possível aqui: uma
  compra recusada faz `ROLLBACK`, e o registro sumiria junto com a tentativa
  que ele existe para documentar. A auditoria funcionaria exatamente nos casos
  em que não é necessária, e falharia em todos os que importam.

- **Chamar o registro de dentro de cada tool** — espalha a responsabilidade por
  três lugares, mistura auditoria com regra de negócio em `tools.ts`, e some
  silenciosamente numa tool nova cujo autor esquecer de instrumentar. O
  envelope resolve os três de uma vez: uma tool nova nasce auditada.

- **Interceptar no handler HTTP, antes do protocolo** — pegaria também as
  chamadas barradas por schema e por autenticação. Descartada porque exigiria
  desmontar o JSON-RPC na mão e porque essas chamadas não são eventos de
  negócio: nada foi consultado, nada foi decidido, nenhum dado do usuário foi
  tocado. Registrá-las encheria a trilha de ruído de cliente malcomportado e de
  requisição não autenticada.

- **Falhar a chamada quando o log não puder ser gravado** ("no log, no
  transaction") — é a regra correta num sistema financeiro de verdade, aplicada
  *antes* do efeito. Aqui inverteria o risco: quando o envelope roda, a compra
  já fez `COMMIT` e já foi confirmada ao usuário. Propagar o erro não
  desfaria nada — apenas transformaria um problema de auditoria em uma compra
  perdida, e ainda relataria como falha algo que aconteceu.

- **Gravar o resultado completo também no catálogo** — repetiria os cinco
  produtos em cada consulta sem acrescentar informação; a decisão ali é sempre
  "listei o que existe".

- **Hash do CPF em vez do CPF** — impediria cruzar o log com `transacoes` e
  `usuarios`, que é justamente o uso, e seria inconsistente com duas tabelas do
  mesmo arquivo que já guardam o dado em claro. O desafio pede "quem", e sem
  CPF não há "quem".

- **Política de retenção** — apagar registros antigos automaticamente contraria
  o propósito de uma trilha de auditoria. O crescimento fica documentado como
  limitação conhecida.

## Consequências

- Toda recusa passa a ter rastro persistente. `node scripts/consultar-chamadas.mjs`
  mostra o que a tabela `transacoes` nunca mostrou.

- Uma tool nova é auditada automaticamente, sem ninguém precisar lembrar.

- **Existe uma janela em que a compra acontece e o log não é gravado**, se a
  escrita falhar entre o `COMMIT` e o `INSERT` do envelope. É consciente: a
  alternativa era perder a compra. Um sistema que precisasse dessa garantia
  gravaria a intenção de auditar *antes* do efeito e confirmaria depois — duas
  escritas, complexidade que este escopo não justifica.

- **A tabela cresce indefinidamente.** Cada turno do chat gera de uma a três
  chamadas. Num uso local não é problema; quem levar isso adiante precisa
  decidir retenção.

- Chamadas barradas por schema não aparecem no log. Quem investigar um cliente
  que envia argumentos inválidos não encontrará rastro — pelo desenho, não por
  esquecimento.

- O log **não é à prova de adulteração**: quem tem acesso de escrita ao arquivo
  SQLite pode editá-lo. Vale para todas as tabelas do projeto, e assinar a
  trilha exigiria uma decisão de infraestrutura própria.

- Se a task #21 mergear, acrescentar `conversa_id` ao registro é um passo
  pequeno e torna possível reconstruir uma conversa inteira a partir do log.
