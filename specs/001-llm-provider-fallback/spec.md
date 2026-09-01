## Problema

`chat-web` hoje fala só com Ollama local, herdado sem alteração do workshop
`ollama-chat`. Não existe plano de contingência se o Ollama não estiver
disponível na máquina onde o projeto roda (avaliação, gravação das
screenshots de entrega, outra máquina do grupo) — o chat simplesmente para
de funcionar. `AGENTS.md` marca o provedor de LLM como decisão em aberto.

## Solução

O chat tenta falar com um LLM local (Ollama) primeiro; se o Ollama não
estiver acessível, o backend usa automaticamente um provedor em nuvem
(OpenRouter) como fallback, sem exigir nenhuma ação do usuário durante a
conversa. Toda configuração (URLs, modelos, chave de API) fica em
variáveis de ambiente carregadas via `dotenvx`, nunca hardcoded no código.

## User stories

1. Como usuário, quero conversar com o agente e ter minhas mensagens
   respondidas mesmo se o Ollama local não estiver rodando, para que o
   chat funcione de forma confiável independente do ambiente.
2. Como usuário, quero que a troca de provedor aconteça de forma
   transparente (sem eu precisar escolher nada na tela), para que a
   experiência de uso não mude.
3. Como usuário, quero ver uma mensagem de erro clara no chat se nem o
   Ollama nem a chave do OpenRouter estiverem configurados, para entender
   por que o chat não respondeu em vez de ver um erro genérico ou travar.
4. Como desenvolvedor(a) rodando o projeto, quero configurar a chave de
   API e os modelos usados através de variáveis de ambiente, para que
   nenhum segredo fique commitado no código.

## Decisões de implementação

- Provedor primário: Ollama local (`OLLAMA_URL`, `OLLAMA_MODEL` — já
  existiam).
- Fallback automático: OpenRouter (`OPENROUTER_API_KEY`,
  `OPENROUTER_MODEL`, default `openrouter/free` — auto-router que escolhe
  um modelo gratuito disponível no momento, já que o roster de free muda
  com frequência), API compatível com OpenAI.
- Critério de fallback: checagem de disponibilidade do Ollama
  (`GET ${OLLAMA_URL}/api/version`, timeout de 1.5s) feita **uma única vez**,
  na primeira mensagem processada pelo processo do servidor, e cacheada em
  memória pro resto da vida do processo — mensagens seguintes reaproveitam
  o resultado, sem checar de novo. Se o Ollama mudar de estado depois
  disso, só reiniciar o servidor (`npm run dev`) reflete a mudança.
- Se o Ollama não responder e `OPENROUTER_API_KEY` não estiver configurada,
  a requisição falha com uma mensagem de erro explícita devolvida no
  stream do chat, explicando o que falta configurar — nunca uma exceção
  genérica engolida.
- Configuração de ambiente via `dotenv` clássico (`import 'dotenv/config'`
  no código, sem CLI wrapper). Arquivo local chamado `.env` (não
  `.env.local`), nunca commitado; `.env.example` documenta as variáveis
  esperadas e é commitado.
- Contrato de tools MCP não muda — os dois provedores recebem a mesma
  lista de tools no mesmo formato (schema de function-calling compatível
  com OpenAI, que ambos aceitam).
- Troca de provedor de LLM e adoção de `dotenvx` são decisões de
  arquitetura — registradas em ADR (`docs/adr/`), conforme critério do
  `AGENTS.md`.

## Decisões de teste

- A lógica de decidir "Ollama indisponível" (timeout/erro de conexão) e a
  montagem/parsing das mensagens pro formato de cada provedor são lógica
  pura — testáveis sem rede, seguindo o padrão `*.check.ts` já usado em
  `mcp-server/src/tools.check.ts`.
- A acumulação dos deltas de tool call do streaming do OpenRouter (parsing
  de SSE, concatenação de argumentos fragmentados) é a parte mais frágil
  dessa feature — precisa de teste dedicado, mesmo padrão `*.check.ts`.
- O caso "nenhum provedor disponível" (Ollama fora do ar, sem chave
  OpenRouter) é testável sem rede — só verifica a mensagem de erro
  retornada.
- Chamada real aos dois provedores (Ollama rodando, OpenRouter com chave
  de verdade) fica como verificação manual — não há infraestrutura de
  teste de integração automatizado neste projeto ainda.

## Fora de escopo

- Suporte a mais de dois provedores (NVIDIA NIM ou outros) — só Ollama +
  OpenRouter por agora.
- Interface pro usuário escolher manualmente qual provedor usar — a troca
  é automática e invisível.
- `dotenvx` e sua criptografia de `.env` — avaliado e descartado; sem
  usar a feature de criptografia, não trazia vantagem sobre o `dotenv`
  clássico.
- Cache ou health-check compartilhado entre requisições — cada mensagem
  faz sua própria checagem de disponibilidade do Ollama.
