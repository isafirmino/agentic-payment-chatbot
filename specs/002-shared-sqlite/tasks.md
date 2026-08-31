# Tarefas — Configuração do SQLite compartilhado

- [x] Criar `.gitignore` na raiz do repo ignorando `data/`
- [x] Acrescentar `.env*` e `!.env.example` em `api-auth/.gitignore` e
      `mcp-server/.gitignore`
- [x] Adicionar `dotenv` às dependências de `api-auth` e `mcp-server`
- [x] Criar `mcp-server/src/db.ts` com `DEFAULT_DATABASE_PATH`,
      `resolveDatabasePath` e `getDb` (conexão sob demanda, `mkdirSync` do
      diretório, e os PRAGMA `journal_mode=WAL`, `busy_timeout=5000`,
      `foreign_keys=ON`)
- [x] Criar `mcp-server/src/db.check.ts` cobrindo `resolveDatabasePath`
      (variável ausente, vazia, caminho relativo e caminho absoluto)
- [x] Chamar `getDb()` no bootstrap de `mcp-server/src/server.ts`, antes do
      `app.listen`
- [x] Declarar `"type": "module"` em `api-auth/package.json` — sem isso o
      `tsx` trata o pacote como CommonJS e o `node` o reinterpreta como
      ESM, e nenhum idioma de diretório funciona nos dois runners
- [x] Ligar `noEmit` e `allowImportingTsExtensions` em
      `api-auth/tsconfig.json`
- [x] Adicionar o script `check` em `api-auth/package.json`, espelhando o
      de `mcp-server`
- [x] Criar `api-auth/src/db.ts` (mesma lógica, no estilo do pacote)
- [x] Criar `api-auth/src/db.check.ts` cobrindo os mesmos casos
- [x] Chamar `getDb()` no bootstrap de `api-auth/src/server.ts`, antes do
      `app.listen`
- [x] Criar `api-auth/.env.example` e `mcp-server/.env.example` com
      `DATABASE_PATH` apontando pro mesmo arquivo, mais as variáveis que
      cada serviço já lê hoje (`PORT`, `JWT_SECRET`)
- [x] Criar `scripts/verify-shared-db.mjs`, que compara o `DATABASE_PATH`
      declarado nos dois `.env`, compara o arquivo que cada conexão
      realmente abriu, escreve por uma e lê pela outra, e limpa a tabela de
      teste no fim
- [x] Escrever `docs/adr/0003-sqlite-compartilhado-entre-servicos.md`
- [x] Documentar o banco compartilhado em `api-auth/README.md` e
      `mcp-server/README.md`
- [x] Rodar `npm run check` em `api-auth` e em `mcp-server` e garantir que
      passam, cobertura incluída
- [x] Rodar `node scripts/verify-shared-db.mjs` e confirmar que os dois
      caminhos resolvidos coincidem, incluindo o caso de falha (`.env`
      divergentes devolvem erro e código de saída diferente de zero)
- [x] Verificar manualmente que `npm run dev` sobe sem erro nos dois
      serviços e que `data/app.db` é criado uma única vez
- [ ] Rodar `pr-review` antes de abrir a PR
