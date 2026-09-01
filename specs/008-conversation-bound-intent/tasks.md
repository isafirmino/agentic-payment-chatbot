# Tarefas — Intenção vinculada à conversa

## Schema

- [x] Acrescentar `conversa_id` à criação de `intencoes` para bancos novos
- [x] Migrar bancos existentes com `ALTER TABLE` guardado por `PRAGMA table_info`
- [x] Testar que a migração é idempotente e não quebra em banco já migrado

## Servidor MCP

- [x] Validar o formato UUID v4 do identificador em `auth.ts`, com teste próprio
- [x] Estender o contexto por requisição de `{ cpf }` para `{ cpf, conversaId }`
- [x] Ler o cabeçalho no handler de `/mcp`, junto da resolução do CPF
- [x] Exigir o identificador em `registrar_intencao` e `realizar_compra`, e não no catálogo

## Regra nas tools

- [x] Gravar `conversa_id` ao registrar a intenção
- [x] Filtrar por `conversa_id` na mesma consulta que já filtra `id` e `owner_cpf`
- [x] Confirmar que nenhum retorno de tool expõe o identificador

## Testes

- [x] Intenção registrada na conversa A e paga na conversa B é recusada
- [x] Registrar e pagar na mesma conversa continua aprovando
- [x] Intenção com `conversa_id` nulo não é pagável por conversa nenhuma
- [x] Identificador ausente ou malformado é recusado antes de qualquer efeito
- [x] Nenhuma transação, estoque ou status muda numa recusa por conversa

## Frontend

- [x] Gerar o identificador uma vez no mount do chat, sem sobreviver a reload
- [x] Enviar no corpo do `POST /api/chat`
- [x] Repassar no cabeçalho ao criar o cliente MCP

## Scripts

- [x] `smoke-catalog-intention.mjs` gera e envia o identificador
- [ ] `verificar-recusas.mjs` gera e envia o identificador — **o arquivo ainda
      não existe na `develop`**, vem na PR #19 (task #9). Quem mergear por
      último acrescenta o cabeçalho; sem ele o script passa a falhar
- [x] Smoke test cobre: intenção sem cabeçalho recusada, catálogo sem cabeçalho aprovado

## Documentação

- [x] ADR 0007 com a decisão e as alternativas descartadas
- [x] `mcp-server/README.md` documenta o cabeçalho e onde ele é exigido
- [x] Emenda em `specs/006-purchase-payment/spec.md` fechando o item de escopo

## Verificação

- [x] `npm run check` no `mcp-server`
- [x] `npm run check` no `chat-web`
- [x] Smoke test com os três serviços no ar
- [x] `verify-shared-db.mjs`
- [x] Verificação equivalente pela API: registrar numa conversa e tentar pagar
      em outra, pelo `/api/chat` real
- [ ] Manual no navegador: registrar, recarregar a página, confirmar recusa e
      novo registro — depende de alguém na máquina
- [x] Rodar `pr-review` antes do PR
