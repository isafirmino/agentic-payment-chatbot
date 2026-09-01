# 0003 — Compartilhar um único arquivo SQLite entre api-auth e mcp-server

Status: aceita

## Contexto

O desafio precisa guardar estado que atravessa os dois backends: o
`api-auth` é dono do cadastro e do limite de gasto de cada usuário, e o
`mcp-server` é dono do catálogo, das intenções de compra e das transações.
Na hora de aprovar uma compra, o `mcp-server` precisa do limite que o
`api-auth` gravou.

Os dois são processos separados e **não conversam por rede entre si** — o
`mcp-server` descobre quem é o usuário lendo o JWT emitido pelo `api-auth`,
não perguntando a ele. Sem chamada de rede e sem estado compartilhado, não
existe caminho pro limite de gasto chegar até a validação da compra.

Nada disso estava configurado: não havia arquivo de banco, pasta, conexão,
nem confirmação de que alguma biblioteca de SQLite funcionaria dentro dos
runners que os dois serviços já usam em desenvolvimento (`tsx watch` no
`api-auth`, `node --watch` no `mcp-server`). Isso travava as três tasks
seguintes, que podiam escrever lógica em paralelo mas não tinham banco pra
abrir.

O `ADR 0002` já havia fixado `dotenv` como forma de configurar ambiente.

## Decisão

Um único arquivo SQLite, em `data/app.db` na raiz do repositório, aberto
pelos dois serviços.

- **Biblioteca: `node:sqlite`**, o módulo nativo do Node.
- **Caminho via `DATABASE_PATH`**, documentado no `.env.example` dos dois
  serviços, carregado com `dotenv` (mesma forma do ADR 0002).
- **Caminho relativo é resolvido contra a raiz do pacote do serviço**, não
  contra o diretório onde o comando foi executado.
- **Cada serviço tem seu próprio `db.ts`**, que abre a conexão sob demanda,
  cria o diretório do banco se não existir, e aplica três configurações de
  sessão: `journal_mode = WAL`, `busy_timeout = 5000` e
  `foreign_keys = ON`.
- **Cada serviço cria apenas as tabelas que é dono**, com
  `CREATE TABLE IF NOT EXISTS` no próprio bootstrap. Não há ferramenta de
  migration nem schema compartilhado.
- `data/` fica fora do git.

## Alternativas consideradas

- **`better-sqlite3`** — descartada. É mais madura e mais documentada, mas
  custa uma dependência nova em dois pacotes e traz binário nativo, que
  precisa de compilação ou download de *prebuild* na instalação. Isso é
  exatamente a classe de problema que o ADR 0002 tentou evitar ao criar o
  fallback de provedor de LLM: quebrar na máquina de outra pessoa do grupo
  ou de quem for avaliar. O `node:sqlite` foi verificado funcionando no
  Node 24.18.0 deste projeto, sem flag e sem warning, nos dois runners.
- **Um banco por serviço, com o `mcp-server` consultando o limite via HTTP
  no `api-auth`** — descartada. Exigiria expor um endpoint novo de consulta
  de limite, autenticá-lo, e acrescentar um salto de rede em toda compra.
  A identidade já viaja no JWT; acrescentar um segundo canal só pra ler um
  número não se paga no escopo deste desafio.
- **Ferramenta de migration compartilhada** — descartada. Com quatro
  tabelas e três dias de prazo, `CREATE TABLE IF NOT EXISTS` no bootstrap
  de cada serviço resolve, e mantém cada tabela sob responsabilidade de uma
  única task.
- **Resolver o caminho contra o diretório de execução (`cwd`)** —
  descartada, e essa é a decisão menos óbvia deste ADR. Seria o
  comportamento padrão do Node, mas quebra em silêncio: se alguém rodar um
  dos serviços a partir da raiz do repositório, o caminho aponta pra fora
  do projeto, e o SQLite **cria um banco vazio em vez de dar erro**. Os
  dois serviços passariam a usar bancos diferentes sem nenhuma mensagem, e
  o sintoma apareceria bem longe da causa — um limite de gasto que "sumiu".
- **Exigir caminho absoluto no `.env`** — descartada: funcionaria, mas
  obriga cada pessoa do grupo a escrever um caminho da própria máquina, e
  quebra o `.env.example` como exemplo copiável.

## Consequências

- **`node:sqlite` ainda é marcado como experimental pelo Node.** Não exige
  flag e não emite warning na versão usada aqui, mas a API pode mudar numa
  versão maior. Se isso acontecer, a troca por `better-sqlite3` fica
  contida nos dois `db.ts`, porque nenhum outro arquivo importa a
  biblioteca direto.
- **O `api-auth` passou a declarar `"type": "module"`.** Ele já escrevia
  sintaxe ESM sem declarar tipo de módulo, e isso fazia os dois runners
  discordarem: o `tsx` tratava os arquivos como CommonJS enquanto o `node`
  os reinterpretava como ESM, emitindo `MODULE_TYPELESS_PACKAGE_JSON`. Na
  prática isso significava que `__dirname` existia num runner e não no
  outro. Quem for mexer no `api-auth` precisa saber que o pacote agora é
  formalmente ESM.
- **O `api-auth` ganhou um script `check`** (teste com cobertura mínima de
  funções e checagem de tipos), que ele não tinha. Sem isso não era
  possível cumprir a regra do `CONTRIBUTING.md` de rodar a verificação em
  todo pacote alterado. Ligar `allowImportingTsExtensions` no `tsconfig`
  foi pré-requisito, mesma correção que o `chat-web` já havia precisado.
- **Os dois `db.ts` são arquivos duplicados** — não há workspace
  configurado neste repositório pra compartilhar um pacote entre os
  serviços. O risco é os dois divergirem em silêncio; `scripts/verify-shared-db.mjs`
  existe pra pegar isso, comparando o arquivo que cada conexão realmente
  abriu.
- **`foreign_keys` vale por conexão, não fica gravado no arquivo.** Qualquer
  código futuro que abra o banco sem passar pelo `getDb()` perde a
  verificação de integridade referencial sem nenhum aviso.
- **Apagar `data/` reseta tudo.** Não há backup nem migração de dados; no
  próximo boot cada serviço recria suas tabelas vazias. É suficiente pro
  escopo do desafio, mas significa que nenhum dado de demonstração
  sobrevive a uma limpeza.
- **A concorrência coberta é a de dois processos em desenvolvimento.** WAL
  com espera de 5 segundos por lock dá conta disso; não foi dimensionado
  pra carga.
- **O formato dos valores monetários não é decidido aqui.** Se as tabelas
  vão guardar número decimal ou inteiro em centavos é decisão das tasks que
  criam as tabelas, e está em aberto nas issues delas.
