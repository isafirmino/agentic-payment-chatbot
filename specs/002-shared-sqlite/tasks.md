# Tarefas — Configuração do SQLite compartilhado

- [ ] Criar `.gitignore` na raiz do repo ignorando `data/`
- [ ] Acrescentar `.env*` e `!.env.example` em `api-auth/.gitignore` e
      `mcp-server/.gitignore`
- [ ] Adicionar `dotenv` às dependências de `api-auth` e `mcp-server`
- [ ] Criar `mcp-server/src/db.ts` com `DEFAULT_DATABASE_PATH`,
      `resolveDatabasePath` e `getDb` (conexão sob demanda, `mkdirSync` do
      diretório, e os PRAGMA `journal_mode=WAL`, `busy_timeout=5000`,
      `foreign_keys=ON`)
- [ ] Criar `mcp-server/src/db.check.ts` cobrindo `resolveDatabasePath`
      (variável ausente, vazia, caminho relativo e caminho absoluto)
- [ ] Chamar `getDb()` no bootstrap de `mcp-server/src/server.ts`, antes do
      `app.listen`
- [ ] Ligar `noEmit` e `allowImportingTsExtensions` em
      `api-auth/tsconfig.json`
- [ ] Adicionar o script `check` em `api-auth/package.json`, espelhando o
      de `mcp-server`
- [ ] Criar `api-auth/src/db.ts` (mesma lógica, usando `__dirname` porque o
      pacote é CommonJS)
- [ ] Criar `api-auth/src/db.check.ts` cobrindo os mesmos casos
- [ ] Chamar `getDb()` no bootstrap de `api-auth/src/server.ts`, antes do
      `app.listen`
- [ ] Criar `api-auth/.env.example` e `mcp-server/.env.example` com
      `DATABASE_PATH` apontando pro mesmo arquivo, mais as variáveis que
      cada serviço já lê hoje (`PORT`, `JWT_SECRET`)
- [ ] Criar `scripts/verify-shared-db.mjs`, que escreve por uma conexão, lê
      pela outra, compara os caminhos resolvidos e limpa a tabela de teste
      no fim
- [ ] Escrever `docs/adr/0003-sqlite-compartilhado-entre-servicos.md`
- [ ] Documentar o banco compartilhado em `api-auth/README.md` e
      `mcp-server/README.md`
- [ ] Rodar `npm run check` em `api-auth` e em `mcp-server` e garantir que
      passam, cobertura incluída
- [ ] Rodar `node scripts/verify-shared-db.mjs` e confirmar que os dois
      caminhos resolvidos coincidem
- [ ] Verificar manualmente que `npm run dev` sobe sem erro nos dois
      serviços e que `data/app.db` é criado uma única vez
- [ ] Rodar `pr-review` antes de abrir a PR
