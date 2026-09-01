# 004 — Cadastro, login e autenticação com JWT

## Problema

O chat (`chat-web`) não tem nenhuma barreira de acesso — qualquer pessoa consegue conversar. O desafio exige que apenas usuários autenticados usem o chat, e cada usuário tenha seu próprio limite de gasto no backend.

## Solução

Sistema de autenticação JWT com:

- Cadastro de novo usuário (nome, CPF, senha)
- Login com CPF e senha
- Token JWT que identifica o usuário (`sub=cpf`, 1h expiração)
- Gate client-side: chat redireciona para login se sem sessão válida
- Limite de gasto (R$ 1.000,00 por padrão) armazenado no backend, consultável para validação de compras

## User stories

1. Como novo usuário, eu quero me cadastrar com nome, CPF e senha, para que eu tenha uma conta e possa fazer login depois.
2. Como usuário, eu quero fazer login com CPF e senha, para que eu acesse o chat e converso com o agente.
3. Como usuário autenticado, eu quero que meu limite de gasto (R$ 1.000,00) seja respeitado nas compras, para que eu não gaste mais do que posso.
4. Como usuário deslogado, eu quero ser redirecionado para o login ao tentar acessar o chat, para que minhas compras fiquem seguras.
5. Como agente MCP, eu quero consultar o limite de gasto de um usuário, para que eu possa validar se uma compra é permitida.

**Casos de erro:**

- Cadastro com CPF duplicado → erro explícito no frontend
- Login com CPF/senha errada → erro explícito no frontend
- Token expirado → redireciona pra login com mensagem

## Decisões de implementação

**Backend (`api-auth/`):**

- Tabela `usuarios(cpf TEXT PRIMARY KEY, nome TEXT NOT NULL, password_hash TEXT NOT NULL, limite_cents INTEGER NOT NULL DEFAULT 100000)` no SQLite (compartilhado via Task 0)
- `POST /auth/cadastro` (nome, cpf, senha) → grava usuário, rejeita CPF duplicado
- `POST /auth/login` (cpf, senha) → valida, emite JWT com `{ sub: cpf, expiresIn: '1h' }`
- `GET /usuarios/me/limite` (requer JWT) → retorna `{ limite_cents }`
- Senhas hasheadas com scrypt (reusar `hashPassword`/`verifyPassword` existentes)
- Porta padrão alterada para 3001 (evitar colisão com Next.js)
- `JWT_SECRET` documentado no `.env.example` como compartilhado com `mcp-server`

**Frontend (`chat-web/`):**

- `src/app/cadastro/page.tsx` (novo): form nome/CPF/senha → `POST /auth/cadastro` → redireciona pra login
- `src/app/login/page.tsx` (novo): form CPF/senha → `POST /auth/login` → grava `{ token, cpf, nome }` em `localStorage` → redireciona pra `/`
- `src/app/page.tsx` (modificado): gate client-side — se sem `localStorage['chat_session']`, redireciona pra `/login`
- `src/app/api/chat/route.ts` (modificado): lê `Authorization` header e repassa pro MCP server
- Env var `NEXT_PUBLIC_AUTH_URL` (ex.: `http://localhost:3001`)

**Contrato MCP:**

- `mcp-server` recebe JWT no header `Authorization: Bearer <token>`, extrai CPF do `sub`
- Antes de `realizar_compra`, valida limite consultando `GET /usuarios/me/limite` em `api-auth`

## Decisões de teste

- Testes unitários em `api-auth/src/app.test.ts`: cadastro (novo/duplicado), login (sucesso/erro), JWT format, endpoint `/usuarios/me/limite`
- Mínimo 80% cobertura de funções (`--test-coverage-functions=80`)
- Verificação manual: cadastro → login → redireciona pra chat; sessão expirada → redireciona pra login

## Fora de escopo

- Validação de formato de CPF (dígito verificador) — aceita qualquer string não-vazia
- Requisitos de força de senha — aceita qualquer string não-vazia
- Logout explícito — recarregar página inteira (tech debt)
- Recuperação de senha — não pedido
- Autenticação social (Google, GitHub, etc.) — não pedido
- Refresh de token — JWT fixo 1h (não pedido)

## Emenda

Correções feitas depois da revisão de PR da feature, sem reabrir as decisões
originais acima:

**Renumeração (colisão, sem mudança de conteúdo):** esta spec e o ADR da
feature foram desenvolvidos em paralelo com a task #7
(`specs/003-catalog-purchase-intent`), e ambos tinham numeração `003`. Como
a #7 chegou primeiro em `develop`, esta spec virou `specs/004-authentication`
e o ADR virou `docs/adr/0004-authentication-jwt-cpf.md`. Só os números e as
referências cruzadas mudaram.

**Correção: quem valida o limite de gasto antes de comprar.** O texto
original (user story 5, "Decisões de implementação" e o ADR) dizia que
`mcp-server` valida o limite consultando `GET /usuarios/me/limite` em
`api-auth`. A task #8 (`realizar_compra`, especificada depois desta), define
que a validação lê `usuarios.limite_cents` **diretamente** da tabela
compartilhada, reaproveitando a conexão de `db.ts` que a task #7 já abre —
sem chamada HTTP. O endpoint `GET /usuarios/me/limite` continua existindo
(é critério de aceite desta própria task e está implementado e testado),
mas não é o mecanismo usado na validação de compra. Ver ADR 0004 pro
raciocínio completo.

**Fix: `mcp-server` não tratava `:memory:` como banco em memória.**
`api-auth/src/db.ts` já resolvia `:memory:` como identificador especial do
SQLite (não como caminho de arquivo), mas a cópia equivalente em
`mcp-server/src/db.ts` — mesma função, escrita independentemente na task #6
— não tinha esse caso especial, e resolvia `:memory:` contra a raiz do
pacote como se fosse um caminho relativo. Isso violava silenciosamente a
premissa de `specs/002-shared-sqlite` de que os dois serviços enxergam o
mesmo banco: um teste que configurasse `DATABASE_PATH=:memory:` achando que
ia isolar em memória, no `mcp-server`, criava um arquivo chamado `:memory:`
no disco. Corrigido adicionando o mesmo tratamento (com teste equivalente
em `db.check.ts`) usado em `api-auth`.

**Fix: `chat-web/src/app/api/chat/route.ts` ignorava rejeição de
autenticação do MCP.** A rota engolia qualquer erro ao conectar ou listar
tools do `mcp-server` e seguia a conversa sem tools, silenciosamente — isso
incluía uma rejeição HTTP 401/403 por token ausente, inválido ou expirado.
Na prática, isso deixava o chat funcionar (com o modelo respondendo
normalmente, sem tools) mesmo sem `Authorization` válido, o que quebra o
requisito de que pular o gate client-side não deve dar acesso real ao chat.
Confirmado com uma chamada direta em `/api/chat` sem header `Authorization`,
que retornava `200` com resposta real do modelo antes do fix. Corrigido
adotando falha fechada: uma rejeição de autenticação (`StreamableHTTPError`
com `code` 401 ou 403) retorna o mesmo status em `/api/chat`; se o
`mcp-server` estiver indisponível e não puder validar o JWT, a rota retorna
503 e não chama o LLM. O chat não replica a validação do token nem recebe o
`JWT_SECRET`; o MCP continua sendo a única autoridade dessa borda.

**Fix: `api-auth` não tinha CORS configurado.** `chat-web` (porta 3000) e
`api-auth` (porta 3001) são origens diferentes, e `api-auth` não respondia
nenhum header `Access-Control-*` — nem no preflight `OPTIONS`, nem na
resposta real. O navegador bloqueava a resposta antes do JS conseguir lê-la,
e `fetch` falhava com `TypeError: Failed to fetch` em `/auth/cadastro` e
`/auth/login`, mesmo com o backend respondendo certo (confirmado com `curl`
simulando o preflight e comparando com o comportamento real no navegador
que motivou este achado). Testes anteriores com `curl` puro não pegaram
isso porque `curl` não aplica CORS. Corrigido adicionando o middleware
`cors` em `api-auth/src/app.ts`, com a origem permitida configurável via
`CORS_ORIGIN` (default `http://localhost:3000`, documentado em
`api-auth/.env.example` e `api-auth/README.md`).

**Fix: sessão expirada não encerrava o acesso no frontend.** Ao receber 401
ou 403 de `/api/chat`, o frontend agora remove `chat_session`, guarda uma
mensagem de sessão expirada e redireciona para `/login`, onde a mensagem é
exibida. Sessões ausentes, incompletas ou com JSON inválido também são
removidas pelo gate antes de liberar a interface.

**Hardening do `api-auth`.** `DEFAULT_LIMITE_CENTS=0` passa a ser aceito
como limite legítimo; valores negativos, fracionários ou inválidos impedem
o boot. JWT assinado sem `sub` é recusado com 401. Em produção,
`JWT_SECRET` é obrigatório e o fallback conhecido existe apenas em
desenvolvimento. O login executa a verificação scrypt também para CPF
inexistente, reduzindo a diferença de tempo entre os dois erros de
credencial.

**Ajuste: `chat-web/src/app/page.tsx` foi reconciliado com a task #10.**
O merge de `develop` trouxe a spec `specs/005-chat-prompt-history`, que
substituiu a UI antiga de abas ("sem memória" / "histórico completo") por
uma única conversa com histórico completo sempre enviado
(`buildPayload`/`toHistory`) e o prompt real da loja. O gate de autenticação
(`useEffect` checando `localStorage['chat_session']`, redirecionamento pra
`/login`) foi movido para cima dessa versão já corrigida, no lugar da UI de
abas antiga que esta feature tinha herdado do workshop.
