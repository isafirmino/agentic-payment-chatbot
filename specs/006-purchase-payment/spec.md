# 006 — Confirmação e pagamento da compra

## Problema

O usuário já consegue consultar o catálogo e registrar uma intenção, mas
ainda não consegue confirmar o pagamento. Sem uma validação autoritativa no
backend, o modelo poderia tentar reutilizar uma intenção, usar uma intenção de
outro usuário, alterar o método de pagamento ou aprovar um valor acima do
limite disponível.

Também não existe um registro auditável das compras aprovadas nem uma operação
atômica que mantenha transação, estoque e intenção consistentes em caso de
falha.

## Solução

Disponibilizar a tool `realizar_compra` para confirmar uma intenção pendente
com cartão ou pix. Antes de qualquer efeito, o backend identifica o usuário
pelo JWT, recupera a intenção e o limite no banco compartilhado e aplica todas
as validações definidas pelo contrato.

Uma compra aprovada gera uma transação, reduz o estoque, marca a intenção como
paga e informa o limite restante. Esses efeitos acontecem juntos; uma falha
reverte todos eles.

## User stories

1. Como usuário autenticado, eu quero pagar uma intenção pendente com cartão,
   para que minha compra seja concluída.
2. Como usuário autenticado, eu quero pagar uma intenção pendente com pix,
   para que eu possa escolher entre os métodos aceitos.
3. Como usuário, eu quero receber o identificador e a data da transação e meu
   limite restante, para que eu saiba que a compra foi aprovada e quanto ainda
   posso gastar.
4. Como usuário, eu quero que uma intenção inexistente, de outro CPF ou ligada
   a um usuário inexistente seja recusada, para que somente minhas intenções
   legítimas sejam utilizadas.
5. Como usuário, eu quero que uma intenção paga ou expirada seja recusada, para
   que a mesma escolha não gere uma nova cobrança indevida.
6. Como usuário, eu quero que um método diferente de `cartao` ou `pix` seja
   recusado com uma explicação compreensível, para que eu possa corrigir minha
   escolha.
7. Como usuário, eu quero que uma compra acima do meu limite restante seja
   recusada, para que o backend não autorize gastos além do permitido.
8. Como backend, eu quero serializar compras e impedir duas transações para a
   mesma intenção, para que chamadas concorrentes não causem cobrança duplicada
   nem ultrapassem o limite acumulado.

## Decisões de implementação

- O servidor MCP passa a expor `realizar_compra`, que recebe somente
  `intencao_id` e `metodo_pagamento`. Identidade, valor, quantidade e limite
  nunca são aceitos dos argumentos da tool.
- O CPF continua vindo exclusivamente do `sub` do Bearer JWT já validado pelo
  servidor MCP.
- O escopo desta feature comprova que a intenção existe, foi persistida pelo
  backend e pertence ao CPF autenticado. Vincular a intenção ao histórico ou a
  uma identidade de sessão de chat fica fora de escopo; o histórico completo
  orienta o agente, mas não participa da autorização.
- O servidor MCP passa a ser dono da tabela `transacoes`, com identificador
  primário, intenção obrigatória e única, valor em centavos, método de
  pagamento, CPF proprietário e data ISO 8601. A intenção referencia a tabela
  `intencoes`.
- Valores monetários permanecem como inteiros em centavos no banco e durante
  todos os cálculos. Conversão para reais acontece somente na resposta.
- A ordem de validação é: intenção existente e pertencente ao CPF, incluindo
  usuário existente; status ainda pendente; instante atual posterior à
  expiração; método fora de `cartao` ou `pix`; valor acima do limite restante.
- Uma intenção é considerada expirada somente quando o instante atual é
  posterior a `expira_em`; no instante exato da expiração ela ainda é aceita.
- Os métodos são estritos e não são normalizados: somente `cartao` e `pix`, na
  grafia exata, são válidos.
- Um JWT válido cujo CPF não exista mais na tabela `usuarios` falha fechado
  como `INTENCAO_INVALIDA`, sem efeitos colaterais.
- O limite restante é o limite do usuário menos a soma de todas as transações
  aprovadas daquele CPF. O saldo é acumulado e não possui período de reset.
- A resposta de sucesso informa o saldo depois de descontar a compra atual e
  usa um identificador criptograficamente aleatório no formato `tx_<random>`.
- As recusas usam `status: "recusado"`, o código estável definido no contrato
  e uma mensagem legível em português. Nenhuma recusa esperada lança exceção
  para o agente interpretar.
- Validações e efeitos da compra executam sob uma transação SQL iniciada com
  bloqueio imediato de escrita. Isso serializa compras concorrentes antes do
  cálculo do limite e evita que duas intenções diferentes ultrapassem juntas o
  saldo disponível.
- Uma aprovação insere a transação, decrementa a quantidade do produto e marca
  a intenção como `paga` em uma única transação SQL.
- A unicidade da intenção na tabela de transações é uma segunda barreira para
  cobrança duplicada. Se a inserção violá-la, toda a operação é revertida e o
  resultado público é `INTENCAO_JA_PAGA`.
- Estoque não é reservado ao registrar a intenção nem revalidado no pagamento,
  conforme o escopo aceito da task. No uso simples e sequencial esperado, uma
  eventual violação da restrição de estoque é um erro técnico e reverte a
  transação inteira, sem cobrança ou estado parcial.

## Decisões de teste

- Testes de schema confirmam criação idempotente da tabela `transacoes`, chave
  estrangeira e unicidade de `intencao_id`.
- Testes de unidade com SQLite cobrem aprovação por cartão e pix, valores em
  centavos persistidos, saldo retornado após a compra e os cinco códigos de
  recusa.
- A prioridade das validações é coberta com estados que seriam recusáveis por
  mais de uma regra.
- A atomicidade é coberta verificando transação, estoque e intenção tanto no
  sucesso quanto depois de uma falha.
- Um teste com conexões independentes ao mesmo arquivo SQLite dispara duas
  compras da mesma intenção e exige exatamente uma aprovação e uma recusa
  `INTENCAO_JA_PAGA`.
- A restrição única e a tradução de sua violação são cobertas separadamente,
  pois o bloqueio imediato normalmente faz a segunda chamada observar o status
  pago antes de tentar inserir.
- A descoberta e a chamada da nova tool são verificadas por smoke test MCP com
  JWT válido.
- O pacote alterado deve passar no `check` completo com cobertura de funções de
  pelo menos 80%.

## Fora de escopo

- Vincular intenções a uma sessão ou comprovar no MCP que o identificador
  apareceu no histórico da conversa.
- Reservar ou revalidar estoque durante o pagamento.
- Repor estoque quando uma intenção expira.
- Reset periódico do limite ou alteração do limite cadastrado.
- Estorno, cancelamento, reembolso ou consulta de transações.
- Log de chamadas recusadas. A tabela registra somente compras aprovadas; sua
  documentação como trilha auditável pertence à task #9.
- Métodos de pagamento além de cartão e pix ou integração com um provedor real.

## Emenda — 2026-09-01

A revisão da PR demonstrou que a decisão de não revalidar estoque estava
baseada numa premissa incorreta: mesmo com um único usuário e sem concorrência,
duas intenções podem ser registradas para as mesmas unidades antes de a
primeira compra reduzir o estoque. A segunda compra então alcançava o
`CHECK (estoque >= 0)`, sofria rollback e devolvia uma exceção genérica ao
agente.

Esta emenda substitui a decisão anterior sobre estoque e o item correspondente
de "Fora de escopo": depois das cinco validações contratuais, o backend também
confere o estoque atual dentro do mesmo `BEGIN IMMEDIATE`. Se o produto não
existir mais ou a quantidade não estiver disponível, nenhuma transação é
criada, a intenção recebe o estado interno `cancelada_estoque` e a tool retorna
`INTENCAO_INVALIDA` com mensagem para registrar uma nova intenção.

O código público permanece dentro do enum fechado da task #8. Repetir a mesma
intenção cancelada retorna a mesma recusa de estoque, em vez de uma exceção ou
de `INTENCAO_JA_PAGA`. Testes cobrem tanto a falta de estoque forçada quanto o
fluxo sequencial com duas intenções legítimas para as mesmas unidades.

O teste concorrente também passa a configurar `busy_timeout = 5000` na conexão
final de verificação. Sem essa espera, o processo pai podia abrir a conexão
enquanto um worker ainda fechava o WAL, causando `database is locked` de forma
intermitente.
