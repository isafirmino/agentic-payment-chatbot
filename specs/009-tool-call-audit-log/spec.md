# 009 — Log auditável de chamadas de tool

## Problema

O `docs/desafio.md` lista, entre os extras opcionais:

> Registrar log auditável de cada chamada de tool (quem, quando, quanto,
> resultado).

A tabela `transacoes` cobre só uma parte disso: quem, quando, quanto e o
resultado das compras **aprovadas**. Fora dela ficam a consulta ao catálogo, o
registro de intenção — inclusive os recusados por estoque ou quantidade — e,
principalmente, as compras **recusadas**: `LIMITE_EXCEDIDO`,
`INTENCAO_INVALIDA`, `INTENCAO_JA_PAGA`, `INTENCAO_EXPIRADA`,
`METODO_INVALIDO`.

São justamente as recusas que uma auditoria mais quer ver, porque são o rastro
das tentativas que o sistema barrou. Hoje elas só aparecem no painel do
`chat-web`, que vive na memória da aba e desaparece ao recarregar a página.
Depois que a conversa acaba, não sobra evidência de que a tentativa existiu.

A lacuna foi decisão consciente da task #8
(`specs/006-purchase-payment/spec.md`, "Fora de escopo": *"Log de chamadas
recusadas. A tabela registra somente compras aprovadas"*). Não é regressão — é
um extra que nunca foi entregue.

## Solução

Toda chamada de tool que chega a executar passa a ser registrada numa tabela
própria, com quem chamou, quando, o que pediu e o que o backend respondeu.

O registro acontece num envelope em volta das tools, **depois** que elas
retornam e **fora** da transação da compra. Essa é a decisão que faz a feature
valer: uma compra recusada por limite faz `ROLLBACK` de tudo o que tocou, e um
log gravado por dentro sumiria junto com a tentativa que ele deveria
documentar.

Consultar o log é um comando, não uma consulta SQL escrita à mão.

## User stories

1. Como pessoa auditando o sistema, eu quero ver todas as tentativas de compra
   recusadas, para confirmar que o backend barrou o que deveria barrar mesmo
   depois de a conversa terminar.
2. Como pessoa auditando, eu quero ver quem fez cada chamada e quando, para
   reconstruir a sequência de eventos de um usuário.
3. Como pessoa auditando, eu quero ver o que foi pedido e o que foi respondido,
   para distinguir o que o modelo tentou do que o sistema permitiu.
4. Como pessoa avaliando a entrega, eu quero um comando que imprima esse log,
   para verificar sem instalar cliente SQLite nem escrever SQL.
5. Como usuário, eu quero que uma falha ao gravar o log não desfaça uma compra
   já confirmada, para não perder uma compra por causa da auditoria.
6. Como pessoa que mantém o servidor, eu quero que uma tool nova entre no log
   automaticamente, para que ninguém precise lembrar de instrumentar cada uma.

## Decisões de implementação

- O registro vive num **envelope aplicado a todas as tools** no momento em que
  elas são declaradas, não dentro de cada uma. Um lugar só, e uma tool nova
  nasce auditada sem ninguém lembrar disso.
- A gravação acontece **depois** que a tool retorna e **fora** de qualquer
  transação de negócio. Uma recusa que reverteu tudo continua registrada.
- Só é registrada a chamada que **chega a executar**. Uma chamada barrada pela
  validação de schema, ou sem autenticação, não chegou ao sistema: nada foi
  consultado, nada foi decidido, nenhum dado do usuário foi tocado. Registrar
  isso encheria o log de ruído de cliente malcomportado. A fronteira é
  documentada, não escondida.
- Os **argumentos** são gravados por inteiro. Depois da task #20 os schemas
  rejeitam o que não bate com o contrato, então o que chega ao envelope é
  pequeno e previsível — e gravar o argumento inteiro é o que permite auditar o
  que o modelo tentou.
- O **resultado** é gravado por inteiro nas tools de intenção, onde ele carrega
  identificador, valor e código de recusa. Para o catálogo é resumido: a
  resposta é o catálogo inteiro, repeti-lo a cada consulta infla o banco sem
  acrescentar informação — a decisão ali é sempre "listei o que existe".
- Uma **falha ao gravar o log não derruba a chamada**. A compra já foi
  confirmada ao usuário quando o envelope roda; derrubá-la por causa do log
  inverteria o risco. A falha vai para a saída de erro do processo.
- O **CPF é gravado em claro**, como já acontece em `usuarios` e `transacoes`.
  Sem ele não se responde "quem", e um hash impediria cruzar o log com as
  outras tabelas — que é o uso. Mudar isso seria decisão de projeto inteiro.
- **Nenhuma política de retenção.** A tabela cresce indefinidamente, e isso
  fica documentado. Apagar trilha de auditoria automaticamente contraria o
  propósito.
- A consulta é um **script próprio**, irmão do de transações e não uma opção
  dele: um relatório é financeiro e agrupado por usuário, o outro é cronológico
  e por chamada.

## Decisões de teste

- Teste de que uma chamada bem-sucedida é registrada com tool, CPF, argumentos,
  resultado e instante.
- Teste de que uma chamada **recusada** é registrada — o caso central, e o que
  distingue esta feature da tabela `transacoes`.
- Teste de que uma compra recusada por limite deixa registro **mesmo tendo
  revertido** todos os efeitos no banco: nenhuma transação criada, mas uma
  linha no log.
- Teste de que o resultado do catálogo é resumido e o das tools de intenção é
  completo.
- Teste de que uma falha ao gravar não propaga para quem chamou, e que o
  resultado da tool volta intacto.
- Teste de que o envelope preserva o retorno da tool sem alterá-lo.
- Teste da migração idempotente da tabela nova.
- O smoke test cobre, na camada MCP, que uma chamada real aparece no log —
  os testes de unidade não passam pelo protocolo.

## Fora de escopo

- Registrar chamadas barradas pela validação de schema ou pela autenticação,
  pelo motivo descrito acima.
- Política de retenção, arquivamento ou rotação.
- Interface de consulta no `chat-web`. O painel já mostra as chamadas da
  conversa corrente; este log serve a quem audita fora dela.
- Alertas, métricas ou detecção de padrão suspeito.
- Gravar o identificador de conversa. A coluna `conversa_id` chega com a
  task #21, ainda em revisão; acrescentá-la ao log é um passo pequeno depois
  que aquela PR mergear, e criar a dependência agora atrasaria as duas.
- Assinar ou tornar o log à prova de adulteração. Quem tem acesso de escrita ao
  arquivo SQLite pode editá-lo; isso vale para todas as tabelas do projeto.
