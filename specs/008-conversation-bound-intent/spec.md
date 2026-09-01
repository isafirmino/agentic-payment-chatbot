# 008 — Intenção vinculada à conversa

## Problema

O `docs/desafio.md` é explícito sobre o que `realizar_compra` precisa recusar:

> Se o modelo inventar um id, repetir um id de outro usuário ou usar um id que
> **não apareceu no histórico da conversa**, a tool retorna `INTENCAO_INVALIDA`.

Hoje a intenção é gravada apenas com `owner_cpf`, e o pagamento busca por
`id + owner_cpf`. Isso cobre id inventado, id vazio e id de outro usuário — mas
não cobre a conversa. Uma intenção pendente registrada em outra aba, ou numa
conversa anterior do mesmo usuário, é aceita mesmo sem nunca ter aparecido no
histórico em que o pagamento acontece.

A lacuna foi decisão consciente da task #8, registrada em
`specs/006-purchase-payment/spec.md` como "Fora de escopo". Não é regressão — é
requisito adiado, e o enunciado o trata como obrigatório.

O risco prático hoje é baixo: exige o próprio usuário autenticado, dentro dos
cinco minutos de validade, e o limite de gasto continua sendo aplicado. Mas a
garantia que o projeto vende é mais forte do que isso. A intenção existe para
que o modelo **não consiga inventar uma compra**; se qualquer intenção pendente
do CPF serve, essa garantia depende de o modelo nunca ter visto um id de outra
conversa — e o histórico é justamente o que ele mais tem à mão.

## Solução

Toda conversa do chat passa a ter um identificador próprio, gerado no
navegador. Ele acompanha as chamadas de ferramenta que criam ou consomem
intenção, é gravado junto com a intenção, e o pagamento só é aprovado se a
conversa que paga for a mesma que registrou.

Para quem usa o chat, nada muda no caminho feliz. Muda um caso: recarregar a
página passa a encerrar a conversa, e uma intenção registrada antes do reload
deixa de ser pagável. Registrar de novo custa um turno e não cobra nada.

O identificador viaja como **cabeçalho HTTP**, nunca como argumento de
ferramenta. Se fosse argumento, o modelo poderia informá-lo — e uma trava que o
próprio modelo preenche não é trava. Pela mesma razão o identificador não
aparece em nenhum retorno de tool: o modelo não precisa conhecê-lo.

## User stories

1. Como usuário, eu quero que uma intenção registrada nesta conversa seja a
   única pagável aqui, para que uma intenção esquecida em outra aba não possa
   ser cobrada sem eu perceber.
2. Como usuário, eu quero que a recusa de uma intenção de outra conversa seja
   indistinguível da recusa de um id inexistente, para que ninguém descubra
   quais identificadores existem testando um a um.
3. Como usuário, eu quero continuar consultando o catálogo normalmente, para
   que a nova exigência não atrapalhe quem só quer ver produtos.
4. Como backend, eu quero recusar qualquer chamada de intenção que não venha
   acompanhada de uma conversa válida, para que omitir o cabeçalho não seja uma
   forma de contornar a regra.
5. Como backend, eu quero tratar as intenções gravadas antes desta mudança como
   não pertencentes a nenhuma conversa, para que elas deixem de ser pagáveis sem
   precisarem ser apagadas.
6. Como pessoa que opera o projeto, eu quero que um identificador de conversa
   malformado seja recusado, para que o cabeçalho não vire porta de entrada
   para lixo no banco.

## Decisões de implementação

- O identificador de conversa é um **UUID v4** gerado no navegador quando a
  página do chat monta. Vive em memória, junto do histórico: um reload gera
  outra conversa, porque sem histórico não existe conversa. Persistir o
  identificador sem o histórico recriaria exatamente o buraco que esta feature
  fecha.
- Ele é enviado do navegador para a rota de chat no corpo da requisição, e
  desta para o servidor MCP em um **cabeçalho HTTP** próprio. Nunca como
  argumento de ferramenta e nunca em retorno de ferramenta.
- O servidor MCP passa a manter, no contexto por requisição que já carrega o
  CPF autenticado, também o identificador de conversa.
- `registrar_intencao` e `realizar_compra` **exigem** o cabeçalho e recusam a
  chamada quando ele falta ou é malformado. `listar_catalogo` não exige: ele
  não cria nem consome intenção, e exigi-lo ali não protegeria nada.
- A tabela de intenções ganha uma coluna para o identificador da conversa,
  **anulável**. Linhas anteriores à mudança ficam com valor nulo, e nulo nunca
  casa com uma conversa — então elas deixam de ser pagáveis por consequência da
  regra, sem precisarem ser removidas. Preserva o histórico e é auditável.
- A conferência da conversa acontece **junto com a de propriedade**, na mesma
  consulta que já filtra por CPF, antes de qualquer efeito. Não é uma checagem
  extra depois: é a mesma barreira, com mais uma condição.
- A recusa devolve `INTENCAO_INVALIDA`, o mesmo código de um id inexistente.
  O enum público da tool não muda. Distinguir os dois casos revelaria que
  determinado identificador existe, informação que quem chama não deveria obter
  de uma recusa.
- Os scripts do repositório que falam com o servidor MCP passam a gerar e
  enviar um identificador de conversa, como qualquer cliente faria.

## Decisões de teste

- Teste de unidade cobrindo o caso central: intenção registrada na conversa A e
  paga na conversa B é recusada com `INTENCAO_INVALIDA`, sem transação criada e
  sem alteração de estoque ou de status.
- Teste de que o caminho feliz continua funcionando: registrar e pagar na mesma
  conversa aprova normalmente.
- Teste de que uma intenção com conversa nula — o estado das linhas anteriores
  à migração — não é pagável por conversa nenhuma.
- Teste de que a ausência e a malformação do identificador são recusadas, e que
  a recusa acontece **antes** de qualquer efeito no banco.
- Teste de que a coluna nova é criada de forma idempotente, sem quebrar em
  banco que já a tenha.
- O catálogo continua acessível sem identificador de conversa; isso é coberto
  pelo smoke test, que exercita a camada MCP de verdade.
- Verificação manual: registrar uma intenção, recarregar a página e confirmar
  que o pagamento é recusado.

## Fora de escopo

- Persistir o histórico da conversa. O chat continua guardando as mensagens só
  na memória da aba; esta feature acompanha esse comportamento em vez de mudá-lo.
- Listar, retomar ou nomear conversas anteriores.
- Expirar ou limpar conversas antigas no banco. As intenções já expiram em cinco
  minutos, e nada além delas referencia a conversa.
- Vincular a conversa ao token de autenticação, ou impedir que o mesmo
  navegador reutilize um identificador que ele mesmo gerou. O adversário deste
  desenho é o modelo, não a pessoa autenticada — que já pode registrar quantas
  intenções quiser dentro do próprio limite.
- Estender a exigência a `listar_catalogo`.
- Registrar em log as chamadas recusadas por conversa divergente; isso pertence
  à issue #22.
