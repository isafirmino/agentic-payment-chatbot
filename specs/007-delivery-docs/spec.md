# 007 — Documentação de entrega, teste manual e evidências

## Problema

O código do desafio está completo — autenticação, catálogo, intenção,
pagamento, histórico e limite acumulado —, mas nada disso está demonstrável
por quem chega de fora. Um avaliador que abre o repositório hoje encontra três
pastas com README próprio, cada uma descrevendo um serviço isolado, e nenhuma
instrução de como fazer os três funcionarem juntos.

Faltam três coisas distintas:

1. **Como executar.** As portas, as variáveis de cada `.env` e a ordem de
   subida existem espalhadas em três READMEs de serviço. Não existe um ponto de
   entrada que leve alguém do clone até uma compra aprovada.
2. **Prova de que funciona.** O desafio pede evidência visual dos fluxos
   obrigatórios. Sem ela, o avaliador precisaria montar o ambiente inteiro para
   confirmar qualquer afirmação.
3. **Prova de que o backend é quem decide.** Esta é a tese central do projeto
   e a mais fácil de perder na apresentação: uma captura de tela do chat mostra
   o agente *dizendo* que o limite foi excedido, o que é indistinguível de um
   modelo inventando a recusa. Sem mostrar a chamada de ferramenta e o retorno
   do backend, a evidência não prova o que precisa provar.

Também não há forma documentada de consultar o log auditável. A tabela
`transacoes` registra cada compra aprovada desde a task #8, mas não existe
comando descrito para lê-la, e a máquina de quem avalia pode não ter um cliente
SQLite instalado.

## Solução

Um `README.md` na raiz que leva qualquer pessoa do clone até uma compra
aprovada, com a tabela consolidada de variáveis de ambiente, a declaração de
qual modelo foi usado, e uma tabela de conformidade que responde item a item o
checklist obrigatório do desafio apontando onde cada requisito está cumprido.

Um roteiro de teste manual repetível que descreve uma única sessão de chat,
com dados exatos e resultado esperado de cada passo, indicando quais passos
geram evidência. Qualquer pessoa do grupo consegue repetir a sessão inteira e
chegar aos mesmos resultados.

Sete capturas de tela versionadas no repositório e embutidas no README,
cobrindo os três fluxos obrigatórios e três tentativas de manipulação do
agente. **Toda captura mostra o painel de ferramentas fixado**, com a chamada
enviada e o retorno recebido do backend — é isso que converte cada imagem de
"o chat respondeu algo" em prova de que a decisão veio do servidor.

Um script de auditoria que imprime as transações registradas junto com o
limite do usuário e o saldo restante, executável com o mesmo Node que já roda
o projeto, sem depender de nenhum cliente SQLite externo.

## User stories

1. Como avaliador do desafio, eu quero um único documento que me leve do clone
   até uma compra aprovada, para que eu não precise reconstruir a ordem de
   execução a partir de três READMEs de serviço.
2. Como avaliador, eu quero saber qual modelo de linguagem foi usado e como o
   provedor é escolhido, para que eu possa confirmar que o requisito de LLM foi
   cumprido e reproduzir o ambiente.
3. Como avaliador, eu quero ver a lista de requisitos obrigatórios do desafio
   com a indicação de onde cada um está atendido, para que eu confira a entrega
   sem procurar evidência espalhada pelo repositório.
4. Como avaliador, eu quero ver uma compra aprovada com cartão e outra com pix,
   para que eu confirme que os dois métodos de pagamento funcionam.
5. Como avaliador, eu quero ver uma tentativa recusada por limite excedido
   depois de compras anteriores, para que eu confirme que o limite é acumulado
   e persistido, e não apenas uma comparação contra o preço de um item caro.
6. Como avaliador, eu quero ver uma tentativa com `intencao_id` inexistente
   sendo recusada, para que eu confirme que a intenção é validada no backend.
7. Como avaliador, eu quero ver, em cada evidência, a chamada de ferramenta e o
   retorno do backend, para que eu distinga uma recusa real de uma frase gerada
   pelo modelo.
8. Como avaliador, eu quero ver o agente sendo instruído a ignorar o limite, a
   forjar um identificador de intenção e a pular o registro da intenção, e o
   backend recusando os três, para que eu confirme que instrução do usuário não
   se converte em decisão de compra.
9. Como avaliador, eu quero um comando que liste as compras registradas com
   limite e saldo restante, para que eu verifique o log auditável sem instalar
   ferramenta adicional.
10. Como membro do grupo, eu quero um roteiro de teste manual com dados exatos,
    para que eu consiga repetir a validação completa antes da entrega final e
    regravar qualquer evidência que fique desatualizada.

## Decisões de implementação

- O `README.md` da raiz é **híbrido**: contém o caminho feliz completo e a
  tabela consolidada de variáveis, e delega o detalhe de cada serviço aos
  READMEs já existentes. Não duplica o conteúdo deles, para não criar dois
  lugares que precisam ser mantidos em sincronia.
- As evidências ficam **versionadas no repositório**, não anexadas a issues ou
  PRs. A entrega do desafio é o link do repositório; a evidência precisa estar
  acessível a partir dele.
- Os arquivos de imagem são numerados na mesma ordem em que a seção "Entrega"
  do desafio lista os fluxos, para que a conferência seja posicional.
- As imagens são **embutidas no README da raiz**, ao final, depois das
  instruções de execução. A avaliação começa pela página renderizada do
  repositório, e a evidência precisa estar visível sem navegação adicional.
- Toda captura inclui o **painel de ferramentas do `chat-web` fixado**. O
  painel já existe desde a task #10 e é fixável por clique, então a evidência
  não depende de manter o cursor parado durante a captura.
- O roteiro de teste manual e o roteiro de captura são **um único documento**.
  São a mesma sessão de chat executada uma vez; separá-los criaria dois
  arquivos descrevendo os mesmos passos.
- A demonstração de limite excedido usa **limite acumulado**, não um item
  isolado acima do teto. Com o limite padrão de R$ 1.000,00, duas compras
  aprovadas deixam saldo insuficiente para a terceira. Isso demonstra a
  política real definida no ADR 0006; uma tentativa com um item mais caro que o
  limite total não distinguiria as duas coisas.
- Os prompts de jailbreak ficam no roteiro de teste manual, junto com o resto
  da sessão. O README exibe apenas as capturas e um parágrafo de contexto.
- O script de auditoria **não recalcula** o saldo por conta própria: usa a
  mesma forma de consulta do backend (`limite_cents` menos a soma de
  `valor_cents` do CPF). Uma segunda implementação da regra poderia divergir da
  primeira e fazer o relatório de auditoria afirmar algo que o sistema não faz.
- O script lê o banco compartilhado pelo mesmo `DATABASE_PATH` já usado pelos
  dois serviços, conforme o ADR 0003.
- O `.env.example` do `chat-web` mantém `qwen2.5:14b` como valor e ganha um
  comentário com alternativas mais leves e o custo de cada uma. Trocar o valor
  padrão alteraria silenciosamente a configuração de quem já montou o ambiente.
- As capturas declaram no README qual modelo as gerou. O desafio exige informar
  qual modelo foi usado; a escolha de provedor permanece a do ADR 0002 (Ollama
  primário, OpenRouter como fallback automático).

## Decisões de teste

- Esta feature não introduz regra de negócio nem tool nova, então não há teste
  automatizado de comportamento a acrescentar. A verificação é o próprio teste
  manual end-to-end, que é o entregável.
- O script de auditoria fica **sem teste automatizado**, seguindo o precedente
  de `verify-shared-db.mjs` (task #6): é um script de leitura em `scripts/`,
  não um módulo de pacote, e não existe `package.json` na raiz onde um
  `node --test` pudesse ser executado. A disciplina que substitui o teste é a
  decisão acima de espelhar a consulta do backend em vez de reimplementá-la.
- O `check` de cada pacote alterado continua obrigatório. Como esta feature
  altera apenas um comentário em `chat-web/.env.example`, o `check` do
  `chat-web` precisa passar para confirmar que nada regrediu.
- O roteiro de teste manual precisa ser executado por inteiro, na ordem, com os
  três serviços em execução, antes de a feature ser considerada pronta. Cada
  captura é a prova de que o passo correspondente foi executado de fato.
- A tabela de conformidade precisa ser conferida linha a linha contra o
  checklist do `docs/desafio.md`, para que nenhum requisito fique declarado
  como cumprido sem evidência correspondente.

## Fora de escopo

- Automatizar a captura das evidências ou o teste end-to-end. As capturas são
  manuais e precisam ser regravadas se a interface mudar.
- Empacotamento, container ou script único de subida dos três serviços. O
  desafio pede execução local, e os três `npm run dev` já são o caminho
  documentado.
- Alterar o comportamento de qualquer serviço. Esta feature é documentação e
  evidência; qualquer defeito encontrado durante o teste manual vira issue
  própria, não correção embutida aqui.
- Registrar em log as chamadas de tool **recusadas**. A tabela `transacoes`
  guarda apenas compras aprovadas, conforme decidido na task #8; ampliar isso
  seria mudança de schema e exigiria ADR.
- Publicar a aplicação, hospedar as evidências fora do repositório ou gravar
  vídeo da execução.
- Traduzir a documentação. O repositório é escrito em português e a entrega
  segue a mesma língua.
