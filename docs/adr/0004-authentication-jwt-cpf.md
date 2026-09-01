# 0004 — Autenticar com JWT usando CPF como subject

Status: aceita

## Contexto

O desafio exige login antes do chat, e limite de gasto e validação de
intenção sempre recalculados no backend — o modelo nunca decide se uma
compra pode acontecer (ver AGENTS.md). A task #5 precisa emitir e validar um
token que `api-auth` e `mcp-server` aceitem em comum, decidindo o que entra
no payload do JWT e como o limite de gasto é consultado depois do login.

## Decisão

Usar o CPF como `sub` claim do JWT HS256, sem role nem limite no payload.
TTL de 1 hora, sem refresh token. Mesmo `JWT_SECRET` compartilhado entre
`api-auth` e `mcp-server` via variável de ambiente, com o mesmo fallback de
desenvolvimento documentado nos dois `.env.example`.

## Alternativas consideradas

- **JWT com role e limite embutidos no payload** — descartada porque o
  limite muda a cada compra aprovada; embutir no token criaria uma cópia
  desatualizada que o backend teria que ignorar de qualquer forma. Mais
  simples nunca colocar isso no token e sempre consultar o banco.
- **Refresh tokens com expiração longa** — descartada porque o desafio não
  pede sessões longas; simplicidade foi priorizada.
- **Banco de dados isolado por serviço** — descartada porque violaria a
  arquitetura de banco compartilhado já decidida na ADR 0003.

## Consequências

- O JWT fica simples: um único claim de identidade (`sub` = CPF), sem
  escopo nem papel.
- Limite de gasto é sempre uma consulta fresca no backend. A task #8
  (`realizar_compra`) lê `usuarios.limite_cents` diretamente da tabela
  compartilhada, reaproveitando a conexão de `db.ts` que a task #7 já abre —
  sem chamada HTTP nem código novo de conexão. O endpoint
  `GET /usuarios/me/limite`, implementado nesta task por ser critério de
  aceite próprio dela, continua existindo no `api-auth`, mas não é o
  mecanismo usado pela validação de compra.
- Token expirado força novo login; sem refresh, uma sessão de mais de 1 hora
  exige autenticar de novo.
- Compartilhar `JWT_SECRET` entre os dois serviços exige manter os `.env`
  sincronizados; um segredo diferente entre eles faz a validação falhar
  silenciosamente (o serviço recusa o token com 401, sem lançar exceção
  visível).
