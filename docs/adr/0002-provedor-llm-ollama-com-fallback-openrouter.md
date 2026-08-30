# 0002 — Ollama local como provedor primário, OpenRouter como fallback automático

Status: aceita

## Contexto

`chat-web` herdava do workshop `ollama-chat` uma dependência única e
hardcoded do Ollama local (ver `docs/adr/0001-base-a-partir-dos-workshops.md`).
O `AGENTS.md` já marcava o provedor de LLM como decisão em aberto. Rodar
só com Ollama é arriscado pra entrega do desafio: a máquina usada pra
avaliar ou gravar as screenshots pode não ter Ollama configurado, e o
desafio explicitamente permite usar Ollama local **ou** uma API gratuita
em nuvem (NVIDIA NIM, OpenRouter).

Precisava também de uma forma de configurar credenciais (chave de API) e
modelo sem hardcode no código, que é regra do projeto (`CONTRIBUTING.md`).

## Decisão

`chat-web` tenta falar com Ollama local primeiro; se não conseguir
(`GET /api/version` não responde em 1.5s), cai automaticamente pro
OpenRouter como fallback, usando o modelo `openrouter/free` por padrão —
o auto-router da OpenRouter, que escolhe um modelo gratuito disponível no
momento em vez de fixar um slug específico (o roster de modelos `:free`
muda com frequência; um slug fixo quebraria quando o modelo saísse do
tier gratuito). Essa checagem acontece uma única vez por processo do servidor e
fica em cache — não é refeita a cada mensagem, pra não pagar o custo de
uma chamada HTTP extra em toda resposta. A troca é transparente pro
usuário — nenhuma escolha manual na tela. Configuração de ambiente via
`dotenv` clássico (`import 'dotenv/config'` no código); arquivo local
`.env` (fora do git), `.env.example` documentado e commitado.

## Alternativas consideradas

- **Só Ollama, sem fallback** — descartada: qualquer ambiente sem Ollama
  configurado (avaliação, gravação de screenshot, máquina de outro membro
  do grupo) quebra o chat inteiro.
- **NVIDIA NIM em vez de OpenRouter** — descartada por ora: cadastro tem
  mais fricção (conta NGC vs. login direto), "grátis" é crédito de trial
  em vez de modelos com tag `:free` perene, e a comunidade/documentação
  pronta é menor. OpenRouter foi mais rápido de colocar pra funcionar
  dentro do prazo de entrega.
- **Provedor escolhido manualmente pelo usuário (variável de ambiente
  fixa, sem fallback automático)** — descartada: menos robusto pro
  cenário real (alguém esquece de configurar/trocar a variável antes de
  rodar em outra máquina) pelo mesmo custo de implementação.
- **`dotenvx`** (dotenvx.com) — considerada primeiro, revertida depois.
  Funciona como CLI wrapper (`dotenvx run -- next dev`) em vez de import
  no código, e sua vantagem real sobre o `dotenv` clássico é a
  criptografia (dá pra commitar `.env` criptografado no git). Avaliamos
  usar essa criptografia e decidimos que não vale o overhead pra um grupo
  pequeno com 3 dias de prazo (gerenciar a chave de decrypt `.env.keys` é
  mais processo do que o projeto precisa agora). Sem essa feature, o
  `dotenvx` não tem vantagem sobre o `dotenv` clássico — só mais uma
  ferramenta pra instalar. Fica registrado aqui como opção se o projeto
  continuar depois da entrega e o time crescer.

## Consequências

- Rodar o projeto sem Ollama **e** sem `OPENROUTER_API_KEY` configurada
  resulta em erro explícito no chat (não silêncio nem exceção genérica) —
  cada pessoa do grupo precisa gerar sua própria chave gratuita no
  OpenRouter pra rodar localmente sem Ollama.
- A checagem de disponibilidade do Ollama só acontece uma vez, na primeira
  mensagem processada pelo servidor — se o Ollama for ligado ou desligado
  depois disso, só reiniciar `npm run dev` reflete a mudança. Aceitável
  pro tamanho deste projeto (ambiente controlado, sessão curta de
  desenvolvimento/demonstração); revisitar se isso incomodar num uso mais
  longo.
- O free tier do OpenRouter tem limite de 20 requisições/min e 200/dia —
  suficiente pra demonstração e testes manuais, mas testes automatizados
  de carga contra ele vão esbarrar nisso rápido.
- Se o projeto continuar após a entrega e o time crescer, revisitar a
  troca pra `dotenvx` com criptografia (`.env` commitado em vez de
  ignorado).
