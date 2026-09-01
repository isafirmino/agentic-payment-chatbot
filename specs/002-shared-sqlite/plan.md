# Plano técnico — Configuração do SQLite compartilhado

Fatos verificados neste ambiente antes de planejar (Node v24.18.0):

- `node:sqlite` funciona sem flag e sem warning nos dois runners: `tsx`
  (`api-auth`) e `node` com type stripping nativo (`mcp-server`).
- `mcp-server` roda como **ESM** (`"type": "module"` declarado):
  `import.meta.dirname` funciona.
- `api-auth` **não declarava tipo de módulo**, e por isso os dois runners
  discordavam sobre ele: o `tsx` tratava os arquivos como CommonJS
  (`__dirname` definido) enquanto o `node` os reinterpretava como ESM
  (aviso `MODULE_TYPELESS_PACKAGE_JSON`), onde `__dirname` não existe.
  Nenhum dos dois idiomas funcionava nos dois runners. Corrigido
  declarando `"type": "module"`, que é o que o código do pacote já era na
  prática — ele sempre usou `import`/`export` e extensão `.js` nos
  imports relativos.
- `node --test` com cobertura roda `.ts` importando `.ts` nos dois
  pacotes; no `api-auth` o `tsc --noEmit` recusa o import com extensão
  `.ts` até `allowImportingTsExtensions` ser ligado (erro TS5097) — mesma
  correção que o commit `2227061` fez no `chat-web`.

## Ordem de implementação

### 1. `.gitignore`

- Criar `.gitignore` na raiz do repo com `data/` (não existe hoje).
- Em `api-auth/.gitignore` e `mcp-server/.gitignore` (hoje só têm
  `node_modules/`), acrescentar `.env*` e `!.env.example`, copiando o
  padrão de `chat-web/.gitignore`.

### 2. Módulo de conexão — `mcp-server/src/db.ts`

Fazer primeiro no `mcp-server`, que é ESM e não precisa de ajuste de
tsconfig. Exporta:

- `DEFAULT_DATABASE_PATH = '../data/app.db'`
- `resolveDatabasePath(raw: string | undefined, packageRoot: string): string`
  — função pura, sem I/O. Usa `DEFAULT_DATABASE_PATH` quando `raw` é
  `undefined` ou só espaço em branco; devolve `path.resolve(packageRoot, valor)`,
  o que já respeita caminho absoluto sem tratamento especial.
- `getDb()` — abre com `new DatabaseSync(path)` na primeira chamada e
  guarda a instância em variável de módulo. Antes de abrir,
  `mkdirSync(dirname(path), { recursive: true })`. Depois de abrir, aplica
  via `db.exec`: `journal_mode = WAL`, `busy_timeout = 5000`,
  `foreign_keys = ON`.

A raiz do pacote sai de `path.join(import.meta.dirname, '..')` — o arquivo
mora em `src/`, então subir um nível dá `mcp-server/`, e daí
`../data/app.db` cai em `<repo>/data/app.db`.

`import 'dotenv/config'` no topo, mesma forma que
`chat-web/src/app/api/chat/route.ts:1` usa (ADR 0002). Requer adicionar
`dotenv` às dependências do `mcp-server`.

### 3. `mcp-server/src/db.check.ts`

Testa só `resolveDatabasePath`, sem tocar em disco. Casos: `undefined`,
string vazia/espaços, caminho relativo (confere que resolve contra a raiz
do pacote passada como argumento, não contra `process.cwd()`), caminho
absoluto (volta normalizado, sem prefixo da raiz).

Padrão de arquivo e imports iguais a `mcp-server/src/tools.check.ts`
(`node:test` + `node:assert/strict`, import com extensão `.ts`).

### 4. Boot do `mcp-server`

Em `mcp-server/src/server.ts`, chamar `getDb()` uma vez antes do
`app.listen`, para o processo falhar ao subir se o caminho estiver
inválido. Não criar tabela nenhuma aqui.

### 5. Módulo de conexão — `api-auth/src/db.ts`

Mesmo conteúdo do item 2, com duas diferenças:

- `api-auth/package.json` precisa declarar `"type": "module"` antes, senão
  `import.meta.dirname` não funciona sob `node --test` (ver fatos acima);
- estilo do arquivo segue o do pacote (aspas duplas, ponto e vírgula,
  como em `api-auth/src/app.ts`).

Duplicação é intencional: a issue #6 pede um `db.ts` em cada serviço, e não
existe workspace/monorepo configurado neste repo para compartilhar um
pacote entre os dois.

Requer adicionar `dotenv` às dependências do `api-auth`.

### 6. `api-auth/src/db.check.ts`

Mesmos casos do item 3, adaptado ao estilo do pacote.

### 7. Ferramental do `api-auth`

- `api-auth/tsconfig.json`: acrescentar `"noEmit": true` e
  `"allowImportingTsExtensions": true` (o primeiro é pré-requisito do
  segundo no TypeScript). Seguro porque o pacote nunca compila — roda por
  `tsx` e não tem script de build.
- `api-auth/package.json`: acrescentar o script `check`, copiando o de
  `mcp-server/package.json`:
  `node --experimental-test-coverage --test-coverage-functions=80 --test src/*.check.ts && tsc --noEmit`

### 8. Boot do `api-auth`

Em `api-auth/src/server.ts`, chamar `getDb()` antes do `app.listen`, igual
ao item 4. Não criar tabela nenhuma.

### 9. `.env.example` dos dois serviços

Criar `api-auth/.env.example` e `mcp-server/.env.example`, seguindo o
formato comentado de `chat-web/.env.example`. Ambos documentam
`DATABASE_PATH=../data/app.db` com comentário explícito de que é o **mesmo
arquivo** nos dois serviços e que mudar em um exige mudar no outro.

Documentar também as variáveis que cada serviço já lê hoje e não estavam
documentadas em lugar nenhum: `PORT` e `JWT_SECRET` no `api-auth`
(`api-auth/src/app.ts:27`, `api-auth/src/server.ts:3`), `PORT` no
`mcp-server` (`mcp-server/src/server.ts:7`).

### 10. Script de verificação de ambiente

`scripts/verify-shared-db.mjs` na raiz, rodado com `node
scripts/verify-shared-db.mjs`. Abre duas conexões independentes — uma pelo
caminho resolvido como o `api-auth` resolveria, outra como o `mcp-server`
resolveria —, escreve por uma, lê pela outra, e imprime o caminho absoluto
efetivo de cada uma. Falha com mensagem explícita e código de saída
diferente de zero se os dois caminhos não coincidirem ou se a leitura não
achar o que foi escrito.

Usa uma tabela `_verificacao_ambiente` própria, com `DROP TABLE` no fim,
para nunca colidir com as tabelas de domínio das tasks seguintes.

Roda em `.mjs` puro para não depender de tsconfig nem de runner de nenhum
dos dois pacotes.

### 11. ADR

`docs/adr/0003-sqlite-compartilhado-entre-servicos.md`, copiando
`docs/adr/TEMPLATE.md`. Registra: arquivo único compartilhado, caminho via
variável de ambiente resolvida contra a raiz do pacote, `node:sqlite` como
biblioteca (com `better-sqlite3` como alternativa descartada e o porquê),
as três configurações de sessão da conexão, e a decisão de cada serviço
criar apenas as próprias tabelas sem migration compartilhada.

Não decide formato de valor monetário — está em aberto nas issues #5/#7/#8.

### 12. Documentação

Acrescentar em `api-auth/README.md` e `mcp-server/README.md` uma seção
curta sobre o banco compartilhado: copiar o `.env.example`, o que
`DATABASE_PATH` significa, e como rodar o script de verificação.

### 13. Verificação final

- `npm run check` em `api-auth` e em `mcp-server`.
- `node scripts/verify-shared-db.mjs` a partir da raiz.
- `npm run dev` nos dois serviços, confirmando que sobem sem erro e que
  `data/app.db` aparece uma vez só.
