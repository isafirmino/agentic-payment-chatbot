# 0007 — Vincular a intenção de compra à conversa por cabeçalho HTTP

Status: aceita

## Contexto

O `docs/desafio.md` exige que `realizar_compra` recuse um `intencao_id` que
"não apareceu no histórico da conversa". Até aqui a intenção era gravada apenas
com `owner_cpf`, e o pagamento buscava por `id + owner_cpf` — cobrindo id
inventado, vazio e de outro usuário, mas não a conversa.

A lacuna foi deliberada: o ADR 0006 e a `specs/006-purchase-payment/spec.md`
colocaram "vincular intenções a uma sessão" fora de escopo da task #8, para
entregar o pagamento atômico primeiro. A revisão da PR #19 trouxe o item de
volta, e ele é obrigatório no enunciado.

A restrição que mais pesa na decisão é qual adversário estamos considerando. Não
é a pessoa autenticada — ela já pode registrar quantas intenções quiser dentro
do próprio limite, e nada do que fizermos aqui muda isso. O adversário é o
**modelo**: ele vê todo o histórico a cada turno, inclusive identificadores de
intenção, e o projeto inteiro se apoia na premissa de que ele não consegue
provocar uma cobrança que o usuário não pediu.

## Decisão

Cada conversa do chat recebe um **UUID v4** gerado no navegador, que viaja até o
servidor MCP em um **cabeçalho HTTP** (`X-Conversa-Id`). O `mcp-server` grava o
identificador em `intencoes.conversa_id` ao registrar, e `realizar_compra` só
aprova quando a conversa que paga é a mesma que registrou.

Três consequências vêm junto, e são parte da decisão:

- O identificador **nunca é argumento nem retorno de ferramenta**. Uma trava que
  o próprio modelo preenche não é trava, e ele não precisa conhecer o valor para
  usar as tools.
- A coluna é **anulável**. Intenções gravadas antes desta mudança ficam com
  valor nulo, e nulo não casa com conversa nenhuma — deixam de ser pagáveis sem
  precisarem ser apagadas.
- A recusa devolve **`INTENCAO_INVALIDA`**, o mesmo código de um id inexistente.

## Alternativas consideradas

- **Verificar no cliente MCP, dentro do `chat-web`** — a rota de chat conferiria
  que o `intencao_id` apareceu como retorno de um `registrar_intencao` no
  histórico daquele turno. Não mexe em schema e sairia em poucas linhas, mas
  coloca a regra no frontend: outro cliente MCP, ou uma requisição feita à mão,
  ignoraria a verificação inteira. O `AGENTS.md` é explícito em não confiar
  nessa camada.

- **Passar o identificador como argumento das tools** — dispensaria cabeçalho e
  contexto por requisição. Descartada porque o argumento é preenchido pelo
  modelo: ele poderia repetir o identificador de outra conversa que viu no
  histórico, que é exatamente o ataque que a feature existe para impedir.

- **Coluna `NOT NULL`** — mais limpa como modelagem, mas exigiria reconstruir a
  tabela ou apagar as intenções pendentes num banco já em uso. O ganho é
  estético; o custo é uma migração destrutiva num projeto que roda sobre um
  arquivo SQLite compartilhado.

- **Código de erro próprio, como `INTENCAO_DE_OUTRA_CONVERSA`** — seria mais
  informativo para depurar, mas ampliaria o enum fechado que o desafio define
  para `realizar_compra` e, pior, vazaria informação: distinguir "não existe" de
  "existe, mas é de outra conversa" confirma a existência de um identificador
  que quem chama não deveria conhecer. Mesma razão pela qual um login não diz se
  errou o usuário ou a senha.

- **Persistir o identificador em `sessionStorage` ou `localStorage`** — faria a
  conversa sobreviver a um reload e evitaria que o usuário precise registrar a
  intenção de novo. Descartada porque recriaria o buraco: uma conversa sem
  histórico, em que o identificador continua válido embora nada do que o
  justifica exista mais. A exigência do desafio é sobre o histórico, não sobre a
  aba.

- **Exigir o cabeçalho nas três tools** — regra mais simples de enunciar, mas
  `listar_catalogo` não cria nem consome intenção. Exigi-lo ali não protegeria
  nada e quebraria qualquer cliente legítimo que só queira ler o catálogo.

## Consequências

- A garantia central do projeto fica mais forte: mesmo que o modelo repita um
  identificador visto no histórico, ele só funciona na conversa que o gerou.

- **Recarregar a página encerra a conversa.** Uma intenção registrada antes do
  reload deixa de ser pagável, mesmo dentro dos cinco minutos de validade. É o
  preço de a regra ser verdadeira, e o custo é baixo: registrar de novo leva um
  turno e não cobra nada. É a mudança de comportamento visível desta decisão.

- Qualquer cliente MCP que fale com este servidor precisa enviar o cabeçalho
  para usar as tools de intenção. Os scripts do repositório foram atualizados
  junto; um cliente externo que não conheça o cabeçalho recebe recusa, por
  desenho.

- Intenções gravadas antes desta mudança continuam no banco, visíveis para
  auditoria, e simplesmente não podem mais ser pagas.

- Se um dia o histórico da conversa passar a ser persistido, esta decisão
  precisa ser revisitada: a conversa poderia então sobreviver a um reload sem
  recriar o buraco, e a escolha de manter o identificador só em memória deixaria
  de se justificar.
