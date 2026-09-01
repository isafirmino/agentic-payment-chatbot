# Plano técnico — Documentação de entrega, teste manual e evidências

## 1. Script de auditoria

- Criar `scripts/consultar-transacoes.mjs` no mesmo estilo de
  `scripts/verify-shared-db.mjs`: módulo ESM avulso, executado com `node` puro
  a partir da raiz, sem dependência de pacote.
- Resolver o caminho do banco pela mesma regra dos serviços: reaproveitar
  `resolveDatabasePath` de `mcp-server/src/db.ts` em vez de reimplementar a
  resolução, como `verify-shared-db.mjs` já faz.
- Abrir o banco com `DatabaseSync` de `node:sqlite` em modo leitura, aplicando
  `PRAGMA busy_timeout = 5000` como todas as outras conexões do projeto.
- Consultar as transações com o mesmo formato usado em
  `realizarCompra` (`mcp-server/src/tools.ts`), juntando `transacoes`,
  `intencoes` e `produtos` para exibir o nome do produto e a quantidade.
- Calcular o saldo com `usuarios.limite_cents` menos `SUM(valor_cents)` do CPF
  — a mesma expressão do backend, não uma reimplementação.
- Agrupar a saída por CPF: cabeçalho com nome, limite e saldo restante, e
  abaixo a lista de compras com data, produto, quantidade, valor e método.
- Converter centavos para reais apenas na impressão, como o restante do
  projeto.
- Tratar banco inexistente, banco sem a tabela `transacoes` e ausência de
  compras como mensagens explicativas e `process.exitCode`, nunca como exceção
  crua. Não usar `process.exit()`, que interrompe o `finally` — o mesmo erro já
  corrigido em `verify-shared-db.mjs`.
- Fechar a conexão em `finally`.

## 1b. Script de verificação das recusas

- Criar `scripts/verificar-recusas.mjs`, no mesmo estilo dos outros scripts da
  pasta: ESM avulso, executado com `node` puro a partir da raiz.
- Autenticar no `api-auth` com CPF e senha passados por argumento, para obter um
  JWT real em vez de assinar um por fora.
- Conectar no `mcp-server` pelo SDK instalado em `chat-web/node_modules`, como o
  `verify-shared-db.mjs` faz ao importar os `db.ts` dos serviços.
- Chamar `realizar_compra` com identificadores inválidos — inventado, plausível,
  vazio, método fora do contrato e, opcionalmente, uma intenção já paga — e
  comparar cada retorno com o código de erro esperado.
- Sair com `process.exitCode = 1` se algum caso não recusar como esperado, para
  que sirva em CI. Nunca `process.exit()`, que pularia o `finally` que fecha a
  conexão MCP.

## 2. Comentário no `.env.example` do `chat-web`

- Manter `OLLAMA_MODEL=qwen2.5:14b` como valor.
- Acrescentar acima dele um comentário no mesmo tom editorial dos outros
  `.env.example` (explicar o porquê, não só o quê): tamanho aproximado do
  modelo padrão, requisito de VRAM, e alternativas com tool calling nativo
  (`qwen2.5:7b`, `qwen2.5:3b`) com o custo de cada uma.

## 3. Roteiro de teste manual

- Criar `docs/teste-manual.md` com pré-requisitos (Ollama instalado, modelo
  baixado, três `.env` criados a partir dos `.env.example`, `JWT_SECRET` igual
  nos dois serviços que o compartilham), ordem de subida dos serviços e como
  confirmar que cada um respondeu.
- Descrever uma única sessão contínua, com passos numerados. Cada passo traz o
  que digitar, o que deve acontecer e — quando gera evidência — o nome exato do
  arquivo de captura.
- Fixar os dados: CPF e senha de teste, limite padrão de R$ 1.000,00 herdado de
  `DEFAULT_LIMITE_CENTS`, e a sequência Fone (cartão) → Mochila (pix) → Cadeira
  (recusa por limite) → `intencao_id` inexistente (recusa por validação).
- Registrar o saldo esperado depois de cada compra aprovada, para que qualquer
  divergência apareça durante a execução e não só na conferência final.
- Instruir a fixar o painel de ferramentas com clique na mensagem antes de cada
  captura, e listar o que precisa estar visível na tela em cada uma.
- Seção final com os três prompts de jailbreak e o comportamento esperado do
  backend em cada um.
- Fechar com a execução do script de auditoria e a saída esperada.

## 4. README da raiz

- Criar `README.md` na raiz com: o que é o projeto e o fluxo em alto nível,
  pré-requisitos, passo a passo de execução dos três serviços na ordem correta,
  tabela consolidada das variáveis de ambiente com o serviço a que pertencem, e
  destaque para as duas que precisam bater entre serviços (`JWT_SECRET` e
  `DATABASE_PATH`).
- Declarar o provedor e o modelo: política do ADR 0002 e o modelo efetivamente
  usado para gerar as evidências.
- Incluir a tabela de conformidade com o checklist obrigatório do
  `docs/desafio.md`, uma linha por requisito, apontando serviço, arquivo ou
  captura que o comprova.
- Documentar o log auditável: o que a tabela `transacoes` guarda e como rodar o
  script de consulta.
- Seção de evidências ao final, com as seis imagens embutidas por caminho
  relativo e uma legenda por imagem explicando o que ela prova.
- Linkar `docs/teste-manual.md`, `docs/architecture.md`, `docs/desafio.md`, os
  READMEs dos três serviços e o índice de ADRs.

## 5. Execução e captura

- Instalar o Ollama, baixar `qwen2.5:7b` e criar os três `.env`.
- Subir `api-auth` (3001), `mcp-server` (4000) e `chat-web` (3000).
- Executar o roteiro inteiro e gravar as capturas em `docs/screenshots/`,
  com os nomes definidos no roteiro.
- Conferir cada imagem antes de commitar: painel de ferramentas visível, código
  de erro legível nas recusas, e nenhum dado sensível na tela.

## 6. Verificação final

- Rodar `npm run check` no `chat-web`, único pacote tocado.
- Rodar `node scripts/verify-shared-db.mjs` e
  `node scripts/consultar-transacoes.mjs` com o banco populado pela sessão.
- Conferir a tabela de conformidade linha a linha contra o `docs/desafio.md`.
- Confirmar que as imagens embutidas renderizam na pré-visualização do README.
- Rodar `pr-review` antes de abrir o PR.
