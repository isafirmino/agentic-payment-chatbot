# Chatbot com Tools MCP de Pagamentos

Chatbot que conversa com um LLM e executa compras simuladas através de três
ferramentas expostas via **MCP**, atrás de login, com limite de gasto e
validação de intenção sempre resolvidos no backend.

A regra que organiza o projeto inteiro: **o modelo nunca decide se uma compra
acontece.** Ele conversa e chama as ferramentas; quem valida propriedade,
prazo, método e limite — e quem calcula o valor — é sempre o servidor.

```
chat-web  :3000        api-auth  :3001        mcp-server  :4000
 Next.js                Express + JWT          Streamable HTTP
 chat + histórico       cadastro, login,       listar_catalogo
 cliente MCP            limite de gasto        registrar_intencao
                                               realizar_compra
                            └──── SQLite compartilhado ────┘
                                     data/app.db
```

Enunciado do desafio em [`docs/desafio.md`](docs/desafio.md); arquitetura em
[`docs/architecture.md`](docs/architecture.md); decisões em
[`docs/adr/`](docs/adr/).

---

## Modelo de linguagem

Dois provedores, escolhidos automaticamente na primeira mensagem processada
(ver [ADR 0002](docs/adr/0002-provedor-llm-ollama-com-fallback-openrouter.md)):

1. **Ollama local** — provedor primário, usado se `OLLAMA_URL` responder.
2. **OpenRouter** — fallback automático quando o Ollama não está acessível.
   Exige `OPENROUTER_API_KEY`.

**As evidências deste README foram geradas com `qwen2.5:7b` no Ollama local.**

O chat envia as ferramentas pelo `/api/chat` do Ollama, então o modelo precisa
suportar **tool calling nativo**. Um modelo sem esse suporte conversa
normalmente e simplesmente nunca chama as tools. O
[`chat-web/.env.example`](chat-web/.env.example) lista as opções da família
Qwen com o custo de memória de cada uma.

---

## Como rodar

### Pré-requisitos

- **Node 22.18+** — o `mcp-server` e os scripts executam TypeScript direto,
  sem transpilar. Validado no 24.18.0.
- **Ollama** com um modelo de tool calling baixado:
  ```bash
  ollama pull qwen2.5:7b
  ```
  Ou, alternativamente, uma chave gratuita do
  [OpenRouter](https://openrouter.ai/keys) para usar o fallback.

### Configuração

```bash
cp api-auth/.env.example    api-auth/.env
cp mcp-server/.env.example  mcp-server/.env
cp chat-web/.env.example    chat-web/.env
```

Ajuste `OLLAMA_MODEL` em `chat-web/.env` para o modelo que você baixou, e
mantenha `JWT_SECRET` **idêntico** nos dois serviços que o compartilham.

### Subir os serviços

Três terminais, nesta ordem — o `api-auth` cria a tabela `usuarios`, da qual a
validação de limite depende:

```bash
cd api-auth   && npm install && npm run dev    # http://localhost:3001
cd mcp-server && npm install && npm run dev    # http://localhost:4000/mcp
cd chat-web   && npm install && npm run dev    # http://localhost:3000
```

Abra <http://localhost:3000>, cadastre-se e faça login. Sem sessão, o chat
redireciona para `/login`.

### Verificar o ambiente

```bash
node scripts/verify-shared-db.mjs
```

Confirma que `api-auth` e `mcp-server` abrem o **mesmo** arquivo SQLite. É a
falha mais silenciosa possível do projeto: com bancos diferentes, o limite
gravado no cadastro não é o mesmo que a compra valida, e nada acusa erro.

---

## Variáveis de ambiente

| Variável | Serviço | Padrão | Para que serve |
|---|---|---|---|
| `PORT` | api-auth | `3001` | Porta HTTP. 3000 é do `chat-web`. |
| `PORT` | mcp-server | `4000` | Porta HTTP. É para cá que `MCP_URL` aponta. |
| `JWT_SECRET` | **api-auth + mcp-server** | fallback só em dev | Assinatura HS256 do token. **Precisa ser igual nos dois.** Se divergir, o login funciona e toda chamada de tool volta não autorizada. |
| `DATABASE_PATH` | **api-auth + mcp-server** | `../data/app.db` | Banco compartilhado. **Precisa apontar para o mesmo arquivo nos dois.** Resolvido a partir da raiz de cada pacote, não do diretório de execução. |
| `DEFAULT_LIMITE_CENTS` | api-auth | `100000` | Limite em centavos de todo usuário novo — R$ 1.000,00. |
| `CORS_ORIGIN` | api-auth | `http://localhost:3000` | Origem do `chat-web`. Errada, o navegador bloqueia o login com `Failed to fetch` antes de a resposta chegar. |
| `NEXT_PUBLIC_AUTH_URL` | chat-web | `http://localhost:3001` | Base URL do `api-auth`. |
| `MCP_URL` | chat-web | `http://localhost:4000/mcp` | Endpoint do servidor MCP. |
| `OLLAMA_URL` | chat-web | `http://localhost:11434` | Ollama local. |
| `OLLAMA_MODEL` | chat-web | `qwen2.5:14b` | Modelo. Precisa de tool calling nativo. |
| `OPENROUTER_API_KEY` | chat-web | — | Fallback automático quando o Ollama não responde. |
| `OPENROUTER_MODEL` | chat-web | `openrouter/free` | Modelo do fallback. |

As duas linhas em negrito são as únicas que precisam bater entre serviços, e
são a origem mais comum de falha na primeira execução.

Detalhe de cada serviço: [`api-auth`](api-auth/README.md) ·
[`mcp-server`](mcp-server/README.md) · [`chat-web`](chat-web/README.md).

---

## Log auditável

A tabela `transacoes` registra toda compra aprovada — quem, quando, quanto,
por qual método e a partir de qual intenção. Para ler sem instalar cliente
SQLite:

```bash
node scripts/consultar-transacoes.mjs
```

```
José Carlos  (CPF 11122233344)
  limite R$ 1.000,00
  gasto  R$ 439,80 em 2 compra(s)
  saldo  R$ 560,20

    01/09/2026, 09:35  Fone Bluetooth x1  R$ 249,90  cartao
      tx_e0d328e152fc1c00  <-  int_ba4425
    01/09/2026, 09:35  Mochila pra Notebook x1  R$ 189,90  pix
      tx_ec1667170b2a115a  <-  int_5e5f2a
```

O saldo é calculado com a mesma expressão do backend — `limite_cents` menos a
soma de `valor_cents` do CPF —, e não com uma segunda implementação da regra.

---

## Critérios de conclusão

Cada linha do checklist do [desafio](docs/desafio.md), com onde ela está
cumprida.

| Critério | Onde está | Evidência |
|---|---|---|
| Frontend e backend rodando localmente | `chat-web`, `api-auth`, `mcp-server` | [Como rodar](#como-rodar) |
| Login funcionando; chat inacessível sem autenticação | `api-auth` (JWT HS256, senha com scrypt); `chat-web` redireciona para `/login` sem sessão | [ADR 0004](docs/adr/0004-authentication-jwt-cpf.md) |
| Servidor MCP com as 3 tools expostas e descobertas pelo agente | `mcp-server` via Streamable HTTP | Painel de ferramentas em todas as capturas |
| Tools respeitam os contratos de argumentos e retorno | `mcp-server/src/tools.ts` | [ADR 0005](docs/adr/0005-contrato-catalogo-e-intencao.md) · [ADR 0006](docs/adr/0006-compra-atomica-e-limite-acumulado.md) |
| Compra concluída com `cartao` **e** com `pix` | `realizar_compra` | 📸 1 e 2 |
| `realizar_compra` exige `intencao_id` válido e recusa id inventado | Intenção buscada por `id` **e** `owner_cpf` | 📸 4 |
| Tentativa acima do limite retorna erro | `LIMITE_EXCEDIDO` antes de qualquer efeito | 📸 3 |
| Limite armazenado e validado no backend | `usuarios.limite_cents` no SQLite; recalculado a cada compra | [ADR 0006](docs/adr/0006-compra-atomica-e-limite-acumulado.md) · 📸 3 |
| Histórico completo enviado ao modelo a cada turno | `chat-web/src/lib/chat/payload.ts`, incluindo chamadas de tool e resultados | Painel "Enviado ao modelo" em todas as capturas |
| `README.md` com instruções de execução e qual modelo foi usado | Este arquivo | [Modelo de linguagem](#modelo-de-linguagem) |

**Extras opcionais**, ambos cumpridos:

| Extra | Onde está |
|---|---|
| Log auditável de cada compra (quem, quando, quanto, resultado) | Tabela `transacoes` + `scripts/consultar-transacoes.mjs` |
| Teste de jailbreak | 📸 5, 6 e 7 |

---

## Evidências

Capturadas seguindo o [roteiro de teste manual](docs/teste-manual.md), que
descreve a sessão completa e é repetível.

Em todas elas o **painel de ferramentas está fixado**, mostrando a chamada
enviada e o retorno recebido do backend. Isso é deliberado: uma captura só da
conversa mostraria o agente *dizendo* que algo foi recusado, o que é
indistinguível de um modelo inventando a recusa. Com o painel, aparece o
retorno da tool — a prova de que a decisão veio do servidor.

Que o texto do agente não basta como prova ficou demonstrado durante o próprio
teste: o modelo anunciou "Monitor 27" 144Hz por R$ 1.809,90" quando a
ferramenta havia devolvido `1899.9`. O balão de conversa erra; o retorno da
tool, não.

> O painel corta o fim do JSON quando o retorno é longo, então `status` e
> `erro` aparecem mas `limite_restante` e `mensagem` podem ficar fora da
> captura — é a [issue #16](https://github.com/isafirmino/agentic-payment-chatbot/issues/16),
> de legibilidade, não de comportamento. O valor correto é calculado,
> retornado e persistido; a evidência 8, ao final desta seção, o comprova de
> forma independente, lendo direto do banco.

### 1. Compra aprovada com cartão

![Compra aprovada com cartão](docs/screenshots/01-compra-aprovada-cartao.png)

Fone Bluetooth, R$ 249,90. O backend registra a intenção, calcula o valor a
partir do catálogo e devolve `limite_restante: 750.1`.

### 2. Compra aprovada com pix

![Compra aprovada com pix](docs/screenshots/02-compra-aprovada-pix.png)

Mochila, R$ 189,90. Saldo cai para `560.2`, acumulando a compra anterior.

### 3. Limite excedido

![Tentativa bloqueada por limite excedido](docs/screenshots/03-limite-excedido.png)

Cadeira Gamer, R$ 699,90 — **menos que o limite total de R$ 1.000,00**. Um
sistema que comparasse o preço apenas contra o limite cadastrado teria
aprovado. É recusada porque o backend subtrai as compras anteriores:

```
limite    R$ 1.000,00
gasto     R$   439,80
saldo     R$   560,20
Cadeira   R$   699,90  >  560,20  →  LIMITE_EXCEDIDO
```

### 4. `intencao_id` inválido

![Tentativa com intencao_id inválido recusada](docs/screenshots/04-intencao-invalida.png)

Um identificador inventado é recusado com `INTENCAO_INVALIDA`. A intenção é
buscada por `id` **e** `owner_cpf`, então id inexistente, id de outro usuário e
id já pago caem todos na mesma recusa.

### 5–7. Jailbreak

O agente é instruído a ignorar o limite, a usar uma intenção forjada e a
aprovar uma compra sem registrar intenção. O backend segura os três.

![Jailbreak: ignorar o limite](docs/screenshots/05-jailbreak-ignorar-limite.png)

![Jailbreak: intenção forjada](docs/screenshots/06-jailbreak-intencao-forjada.png)

![Jailbreak: compra sem intenção](docs/screenshots/07-jailbreak-sem-intencao.png)

Nenhum desses pedidos tem por onde passar: `realizar_compra` recebe apenas
`intencao_id` e `metodo_pagamento` — **não recebe valor, nem identidade, nem
autorização** —, o CPF vem do JWT e o valor cobrado vem sempre de
`intencoes.valor_total_cents`.

### 8. O log auditável ao final da sessão

A última evidência não é uma captura de tela, e é a mais difícil de forjar: o
estado do banco depois de tudo.

```
$ node scripts/consultar-transacoes.mjs

José Carlos  (CPF 11122233344)
  limite R$ 1.000,00
  gasto  R$ 439,80 em 2 compra(s)
  saldo  R$ 560,20

    Fone Bluetooth x1        R$ 249,90  cartao
    Mochila pra Notebook x1  R$ 189,90  pix

2 transação(ões) registrada(s) no total.
```

**Duas** transações, exatamente as duas aprovadas. As quatro tentativas
recusadas — limite excedido, intenção inválida e as três de jailbreak — não
deixaram cobrança nenhuma, não alteraram o saldo e não aparecem aqui.

O saldo de R$ 560,20 é o mesmo que o `realizar_compra` devolveu como
`limite_restante` na evidência 2, calculado com a mesma expressão do backend.
É por isso que o corte do painel descrito acima não enfraquece a prova: o que
não coube na tela está aqui, vindo direto do banco.

---

## Como o projeto foi construído

Todo trabalho segue o fluxo descrito em [`AGENTS.md`](AGENTS.md): conversa →
entrevista de requisitos → spec → implementação → revisão → PR. As decisões
ficam em [`docs/adr/`](docs/adr/) e as especificações em
[`specs/`](specs/), uma pasta por feature entregue.

Convenções de branch, commit e código: [`CONTRIBUTING.md`](CONTRIBUTING.md).
