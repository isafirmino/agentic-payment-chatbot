# 002 — Configuração do SQLite compartilhado

## Problema

Nenhum dos três serviços tem SQLite configurado. Não existe arquivo de
banco, não existe pasta pra ele, nenhum serviço abre conexão, e ninguém
confirmou que a biblioteca de SQLite escolhida funciona dentro dos runners
que `api-auth` e `mcp-server` já usam em desenvolvimento.

Isso trava três tasks ao mesmo tempo: cadastro/login (que precisa gravar
`usuarios`), catálogo/intenção e limite/compra (que precisam de
`produtos`, `intencoes` e `transacoes`). As três podem escrever lógica em
paralelo, mas nenhuma consegue rodar ou testar de verdade enquanto não
existir um banco pra abrir.

`api-auth` e `mcp-server` são processos separados e não conversam por rede
entre si — o `mcp-server` descobre a identidade do usuário pelo JWT, não
perguntando ao `api-auth`. Como consequência, os dois precisam ler e
escrever no **mesmo arquivo físico** de banco. Se cada um abrir um arquivo
diferente, a validação de limite de gasto olha para um saldo que não
existe, e o SQLite não avisa: ao receber um caminho inexistente ele cria um
banco novo e vazio, sem erro.

## Solução

Um arquivo SQLite único, compartilhado, na raiz do repositório, que os dois
serviços abrem por um caminho vindo de variável de ambiente. Cada serviço
ganha um módulo de conexão pronto para uso, que abre esse arquivo com as
configurações corretas para acesso por dois processos simultâneos e cria a
pasta do banco se ela ainda não existir.

Quem pegar as tasks seguintes só precisa criar as próprias tabelas — não
precisa decidir biblioteca, caminho, nem configuração de conexão.

## User stories

1. Como desenvolvedor(a) do time, quero um módulo de conexão pronto nos
   serviços que precisam de banco, para que eu só precise criar minhas
   tabelas em vez de reinventar como abrir o SQLite.
2. Como desenvolvedor(a) do time, quero que os dois serviços abram
   comprovadamente o mesmo arquivo, para que o limite de gasto gravado pelo
   cadastro seja o mesmo limite que a compra valida.
3. Como desenvolvedor(a) do time, quero uma forma automatizada de verificar
   que meu ambiente local está com o banco compartilhado funcionando, para
   que eu descubra um problema de configuração antes de gastar tempo
   debugando a minha feature.
4. Como desenvolvedor(a) do time, quero que o serviço falhe ao subir se o
   caminho do banco estiver errado, para que o erro apareça na hora de
   iniciar e não no meio de uma requisição.
5. Como desenvolvedor(a) do time, quero que o arquivo de banco e os `.env`
   locais fiquem fora do git, para que dados de execução e segredos não
   sejam commitados por acidente.

## Decisões de implementação

- **Biblioteca: `node:sqlite`**, o módulo nativo do Node. Verificado
  funcionando sem flag e sem warning no Node 24.18.0 deste projeto, nos
  dois runners em uso: `tsx` (`api-auth`) e execução direta de `.ts` pelo
  Node com type stripping nativo (`mcp-server`). Não acrescenta dependência
  a nenhum pacote. A alternativa `better-sqlite3` foi descartada — o
  porquê fica no ADR.
- **Um arquivo de banco único** na raiz do repositório, numa pasta `data/`
  ignorada pelo git. O banco é dado de execução, não código.
- **Caminho vem de variável de ambiente** (`DATABASE_PATH`), documentada no
  `.env.example` de `api-auth` e de `mcp-server` apontando para o mesmo
  lugar. Quando a variável não estiver definida, o módulo usa um caminho
  padrão que resolve para o mesmo arquivo — rodar sem `.env` funciona.
- **Caminho relativo é resolvido contra a raiz do pacote do serviço**, não
  contra o diretório de onde o comando foi executado. Resolver contra o
  diretório de execução faria os dois serviços abrirem arquivos diferentes
  em silêncio quando alguém rodasse a partir da raiz do repositório.
  Caminho absoluto continua sendo respeitado como está.
- **A conexão é aberta sob demanda e reaproveitada**, não no carregamento
  do módulo. Assim o módulo pode ser importado por um teste sem criar
  arquivo no disco como efeito colateral. Cada serviço força a abertura uma
  vez durante a inicialização, para que um caminho inválido derrube o boot
  em vez de falhar no meio de uma requisição (user story 4).
- **A conexão define três configurações de sessão**, que é onde elas
  precisam estar:
  - modo de journal *write-ahead logging*, para que leitura e escrita de
    processos diferentes não se bloqueiem;
  - tempo de espera por lock ocupado, para que uma disputa entre os dois
    serviços aguarde em vez de falhar imediatamente;
  - verificação de chave estrangeira ligada — o SQLite a mantém desligada
    por padrão e o ajuste vale por conexão, não fica gravado no arquivo.
    Sem isso, as declarações de referência entre tabelas que as tasks
    seguintes escreverem não são verificadas por nada.
- **Nenhuma tabela do domínio é criada nesta feature.** Cada serviço cria
  as tabelas que é dono, no próprio bootstrap, nas tasks seguintes.
- **Carregamento de `.env` via `dotenv`**, mesma abordagem que o ADR 0002
  já fixou para o `chat-web`.
- **`api-auth` ganha um script de verificação** equivalente ao dos outros
  pacotes (testes com cobertura mínima de funções e checagem de tipos).
  Hoje ele não tem nenhum, o que torna impossível cumprir a regra do
  `CONTRIBUTING.md` de rodar a verificação em todo pacote alterado.
- **`api-auth` passa a declarar explicitamente que é um pacote ESM.** Ele já
  escrevia código nesse formato sem declarar nada, e isso fazia os dois
  runners que o pacote usa discordarem sobre como interpretá-lo — o que
  quebra qualquer forma de descobrir o diretório do próprio módulo, algo
  que a resolução do caminho do banco precisa. Descoberto durante a
  implementação, não previsto no planejamento inicial.

## Decisões de teste

- **Teste unitário** para a resolução do caminho do banco: é lógica pura
  (entra variável de ambiente e raiz do pacote, sai caminho absoluto) e não
  toca em disco nem em rede. Cobre: variável ausente (usa o padrão),
  caminho relativo (resolve contra a raiz do pacote, não contra o diretório
  de execução), caminho absoluto (é respeitado sem alteração) e variável
  presente porém vazia (tratada como ausente). Roda nos dois serviços,
  seguindo o padrão de arquivo de verificação já usado no `mcp-server`.
- **Verificação automatizada de ambiente** para o comportamento que só
  existe entre processos: um script escreve por uma conexão e lê pela
  outra, provando que os dois serviços chegam ao mesmo arquivo. Isso não é
  teste unitário — depende do disco e do ambiente local — mas também não
  pode ficar só como texto num documento, porque é exatamente o que as três
  tasks seguintes precisam confirmar antes de começar. O script apaga o que
  criou ao terminar.
- **Verificação manual** de que os dois serviços sobem sem erro com o banco
  configurado. Não há infraestrutura de teste de integração que suba os
  processos de verdade neste projeto.
- Abrir conexão, criar diretório e aplicar configurações de sessão não
  ganham teste unitário próprio: são chamadas diretas à biblioteca, e o
  script de verificação já exercita esse caminho de ponta a ponta.

## Fora de escopo

- **Qualquer tabela do domínio** (`usuarios`, `produtos`, `intencoes`,
  `transacoes`) e seus dados iniciais — pertencem às tasks de cadastro,
  catálogo e compra.
- **Decidir se valores monetários ficam em número decimal ou em inteiro de
  centavos.** Levantado como questão em aberto nas tasks que criam as
  tabelas; afeta três tabelas que esta feature não é dona.
- **Migrations e versionamento de schema.** Cada serviço garante seu pedaço
  do schema de forma idempotente no próprio bootstrap; não há ferramenta de
  migration compartilhada.
- **`chat-web`** não usa banco e não é tocado por esta feature.
- **Contrato de JWT compartilhado entre os serviços** (segredo comum,
  formato do token) — pertence à task de cadastro/login e ao ADR dela.
- **Pool de conexões, concorrência além do padrão do SQLite, e backup ou
  reset do banco.** Apagar o arquivo recria tudo no próximo boot; isso é
  suficiente para o escopo do desafio.
