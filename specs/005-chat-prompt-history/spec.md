# 005 — Prompt do chat e histórico completo

## Problema

O chat ainda é o do workshop de origem, e isso quebra o desafio em dois
pontos diferentes.

O primeiro é o prompt do sistema: ele apresenta ao modelo duas ferramentas
que deixaram de existir (hora atual e busca genérica de itens) e não fala
nada das três ferramentas reais de compra. Mesmo depois que elas existirem
no servidor MCP, o agente não vai saber conduzir uma compra, porque nada
no prompt diz que elas existem, em que ordem usar, quais métodos de
pagamento valem, nem que a intenção de compra tem prazo.

O segundo é mais grave. A tela tem um seletor com dois modos de conversa, e
um deles envia ao modelo **apenas a última mensagem**, sem histórico
nenhum. O desafio exige o contrário, textualmente: todo o histórico da
conversa deve ser enviado ao agente a cada turno, incluindo as chamadas de
ferramenta e seus resultados. Pior: esse modo quebrado é o que abre por
padrão. Quem abrir o chat e sair usando está, sem saber, no modo que viola
um critério obrigatório — e as capturas de tela da entrega poderiam ser
feitas nele sem ninguém perceber.

## Solução

Um único modo de conversa, que sempre envia a conversa inteira ao modelo, e
um prompt que ensina o agente a conduzir uma compra de ponta a ponta: o que
cada ferramenta faz, em que ordem chamá-las, quais métodos de pagamento
aceitar, que a intenção expira, e como explicar cada recusa possível em
linguagem natural.

O painel que mostra exatamente o que foi enviado ao modelo em cada turno
continua existindo, e passa a poder ser fixado na tela — ele é a evidência
visual de que o histórico completo está sendo enviado, e é o que torna as
capturas de tela da entrega verificáveis em vez de só afirmadas.

## User stories

1. Como usuário, quero pedir o catálogo, escolher um produto e pagar
   conversando normalmente, para que eu complete a compra sem precisar
   saber que existem ferramentas por trás.
2. Como usuário, quero que o agente lembre do que já foi dito na conversa,
   para que ele não me pergunte de novo qual produto eu escolhi na hora de
   pagar.
3. Como usuário, quero que o agente me pergunte se prefiro cartão ou pix
   antes de cobrar, para que eu escolha como pagar.
4. Como usuário, quero que o agente me avise que a intenção de compra tem
   prazo, para que eu saiba que preciso confirmar em seguida.
5. Como usuário, quando a compra for recusada, quero que o agente me diga o
   motivo em português claro e o que eu posso fazer, para que eu resolva
   sem precisar entender códigos de erro.
6. Como avaliador do desafio, quero ver na tela exatamente o que foi
   enviado ao modelo em cada turno, para que eu confirme que o histórico
   completo está indo junto a cada mensagem.
7. Como avaliador do desafio, quero que não exista nenhum modo de uso que
   envie a conversa sem histórico, para que não seja possível produzir uma
   evidência inválida por acidente.

## Decisões de implementação

- **O modo sem histórico deixa de existir**, e não vira uma opção
  desligada por padrão. O tipo que representa "qual conversa está ativa" é
  removido, junto com o estado que guardava duas conversas em paralelo e
  com os botões que trocavam entre elas. A montagem da mensagem passa a ter
  um caminho só.
- **A montagem do que é enviado ao modelo sai do componente de tela** e
  vira uma função pura, em módulo próprio, que recebe o histórico e a nova
  mensagem do usuário e devolve a lista completa a enviar. Isso existe para
  que o critério obrigatório do desafio deixe de depender de inspeção
  visual e passe a ter teste automatizado.
- **As chamadas de ferramenta e seus resultados passam a fazer parte do
  histórico** enviado nos turnos seguintes. O desafio exige o histórico
  completo "incluindo as chamadas de ferramenta e seus resultados", e essa
  segunda metade não era cumprida: o backend montava a sequência
  corretamente dentro de uma requisição, mas ela era descartada ao fim da
  resposta, e a tela guardava as ferramentas apenas para desenhar o painel.
  Na prática o agente perdia, no turno seguinte, o que o catálogo tinha
  devolvido. A expansão dos turnos da tela para essa sequência é feita no
  mesmo módulo testável, no formato que a rota já usa internamente: uma
  mensagem do assistente com a chamada, seguida de uma mensagem com o
  resultado.
- **O prompt do sistema passa a ser dado desse mesmo módulo**, não texto
  solto dentro do componente, para poder ser verificado por teste.
- **O prompt descreve as três ferramentas pelo nome real**, a ordem
  obrigatória entre elas, os dois métodos de pagamento aceitos, o prazo de
  validade da intenção, e instrui a nunca inventar identificador, preço ou
  produto.
- **O prompt inclui instrução explícita para cada recusa esperada**, com o
  que dizer e o que oferecer em seguida. Os códigos de recusa seguem o
  contrato do desafio e o das ferramentas de catálogo e intenção.
- **Isso é experiência de uso, não segurança.** O prompt existe para o
  agente explicar bem a recusa, não para impedir a compra. Quem impede é
  sempre o backend, que recalcula limite e valida a intenção antes de
  qualquer efeito real, e não confia em nada que o modelo tenha dito. Um
  prompt bem escrito reduz o incômodo do usuário; ele não é barreira.
- **O painel que mostra o que foi enviado ao modelo é mantido** e ganha a
  possibilidade de ser fixado com um clique, além de continuar aparecendo
  ao passar o mouse. Sem isso, capturar a tela dele exige manter o cursor
  parado no lugar certo enquanto se aciona a captura, o que é justamente o
  que a entrega precisa fazer.
- Nenhum contrato entre serviços muda, nenhuma dependência nova entra, e
  nenhuma regra de negócio é decidida aqui — então esta feature **não abre
  ADR**.

## Decisões de teste

- **Teste unitário da montagem da mensagem**, que é onde mora o critério
  obrigatório. Cobre: o prompt do sistema vem sempre em primeiro lugar; o
  histórico inteiro é preservado na ordem original; a nova mensagem do
  usuário entra por último; conversa vazia produz apenas prompt e mensagem;
  e o histórico não é truncado conforme cresce.
- **Teste da expansão das chamadas de ferramenta no histórico**: turno sem
  ferramenta continua sendo uma mensagem só; turno com ferramenta vira a
  chamada mais o resultado, nessa ordem; várias ferramentas no mesmo turno
  preservam a ordem entre si. E um teste escrito na forma do critério do
  desafio: depois de o catálogo ter respondido, o identificador do produto
  ainda precisa estar no que é enviado no turno seguinte.
- **Teste do conteúdo do prompt**, afirmando que ele cita as três
  ferramentas reais, os dois métodos de pagamento, e que não sobrou
  nenhuma menção às ferramentas do workshop. É o tipo de coisa que se perde
  em refatoração silenciosa.
- **Verificação manual** do fluxo conversado de ponta a ponta e do sumiço
  do seletor de modo. Comportamento de componente React não tem
  infraestrutura de teste neste projeto, e criar uma só para isto seria
  desproporcional.
- A verificação manual completa da compra depende de ferramentas que ainda
  não existem; o que der para verificar agora é o catálogo e o registro de
  intenção, e o restante fica registrado como pendente até as tarefas de
  compra entrarem.

## Fora de escopo

- Autenticação, tela de login e repasse de identidade, que pertencem à
  tarefa de cadastro e login e mexem neste mesmo arquivo.
- As ferramentas em si: catálogo, intenção e compra são de outras tarefas.
  Aqui só se escreve o texto que ensina o agente a usá-las.
- Persistir a conversa entre recarregamentos da página. O histórico vive na
  memória da aba, e o desafio não pede o contrário.
- Redesenho visual do chat. A tela muda só no que a remoção do seletor
  exige e no painel de evidência.
- Limitar o tamanho do histórico enviado. O desafio pede o histórico
  completo, e conversas de demonstração não chegam perto do limite de
  contexto.

## Melhorias sugeridas para depois da entrega

Coisas notadas durante esta feature que não valem o custo agora, mas que
alguém deveria pegar quando a base do projeto estiver pronta:

- **Abrir o painel de inspeção pelo teclado.** A mensagem do usuário virou
  clicável, mas continua sendo um elemento sem papel de botão: não dá para
  chegar nela com Tab nem acionar com Enter. Quem usa leitor de tela ou
  navega só pelo teclado não alcança o painel. A correção é pequena (papel,
  índice de tabulação e tratador de tecla), mas mexer em acessibilidade no
  meio da entrega é risco sem retorno — o desafio não avalia isso, e a
  mudança pede um teste manual que hoje ninguém faria. Vale fazer junto com
  uma passada geral de acessibilidade, não isolada.
