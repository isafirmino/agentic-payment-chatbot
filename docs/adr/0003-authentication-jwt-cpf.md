# ADR 0003: JWT com CPF como subject e limite de gasto no backend

## Status

**Accepted**

## Context

A autenticação no desafio de pagamentos requer:

1. Login com CPF e senha
2. Emissão de JWT para autenticar requisições no agente
3. Validação de limite de gasto antes de executar compras
4. Múltiplos serviços (api-auth, mcp-server) compartilhando JWT_SECRET

## Decision

1. **JWT Subject = CPF**: Usar o CPF como `sub` claim no JWT, sem role ou limite no payload
   - Razão: CPF é o único identificador único do usuário no contexto do desafio
   - Sem role: desafio não define autorização por papel
   - Sem limite no payload: limite pode mudar entre requisições, validar sempre no backend é mais seguro

2. **Limite de Gasto no Backend**: GET /usuarios/me/limite retorna o limite atual
   - mcp-server valida limite **antes** de `realizar_compra`
   - Nunca confiar no que o modelo LLM diz sobre o limite
   - Query em database garante valor sempre atualizado

3. **Expiração de Token = 1 hora**: JWT_TTL = "1h"
   - Sem refresh tokens por simplicidade (desafio não especifica sessões longas)
   - Novo login necesário após expiração

4. **JWT_SECRET Compartilhado**: Mesma chave em api-auth e mcp-server
   - ⚠️ Ambos `.env.example` documentam a mesma chave "workshop-dev-secret-do-not-use-in-prod"
   - Em produção: usar Azure Key Vault ou HashiCorp Vault
   - Atualmente: risco aceitável para desafio/workshop

5. **Database Shared**: ../data/app.db usado por ambos os serviços
   - SQLite com WAL mode para multi-writer safety
   - Timeout 5000ms para contenção entre api-auth e mcp-server
   - Foreign keys ON para integridade referencial

## Consequences

- ✅ Simples: apenas 1 subject (CPF), sem roles/scopes/claims extras
- ✅ Seguro: limite sempre validado no backend, modelo não pode bypassar
- ✅ Operacional: token expirado força novo login, sem complexidade de refresh
- ⚠️ Risco: compartilhamento de JWT_SECRET requer sincronização de .env
- ⚠️ Risco: limite muda apenas por checkout, sem cache entre requisições

## Alternatives Considered

1. **JWT com role + limite no payload**
   - Rejeitada: complexidade desnecessária, limite pode expirar, modelo poderia abusar

2. **Refresh tokens com expiração longa**
   - Rejeitada: desafio não menciona sessões longas, simplicidade preferível

3. **Database isolado por serviço**
   - Rejeitada: contratos entre serviços ficam complexos, violaria arquitetura de Task #0

## References

- [specs/003-authentication/spec.md](../specs/003-authentication/spec.md)
- [specs/003-authentication/plan.md](../specs/003-authentication/plan.md)
- [ADR 0001: Base a partir dos workshops](./0001-base-a-partir-dos-workshops.md)
- [ADR 0002: Provedor LLM Ollama com fallback OpenRouter](./0002-provedor-llm-ollama-com-fallback-openrouter.md)
