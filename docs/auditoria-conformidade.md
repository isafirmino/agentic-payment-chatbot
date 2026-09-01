# Auditoria de conformidade — 2026-09-01

## Resultado

A aplicação atende aos dez critérios obrigatórios de `docs/desafio.md` no
estado auditado. A conclusão combina inspeção do código, testes automatizados,
build de produção, smoke test pelo protocolo MCP e verificação do banco
compartilhado. Nenhuma decisão de produto ou arquitetura foi alterada.

## Matriz de evidências

| Critério obrigatório | Situação | Evidência principal |
|---|---|---|
| Frontend e backend locais | atende | build do `chat-web`; processos documentados no README |
| Login e chat protegido | atende | JWT HS256 e scrypt em `api-auth`; rota de chat falha fechada quando o MCP recusa a sessão |
| Três tools MCP descobertas | atende | smoke encontrou exatamente `listar_catalogo`, `registrar_intencao` e `realizar_compra` |
| Contratos de argumentos e retorno | atende | schemas MCP restritos; testes de contrato e smoke de schema |
| Compra com cartão e pix | atende | testes de ambos os caminhos e evidências no README |
| Intenção válida e id inventado recusado | atende | vínculo por CPF e conversa; testes de id inexistente, alheio, pago, expirado e de outra conversa |
| Limite excedido retorna erro | atende | `LIMITE_EXCEDIDO` antes de efeitos; teste confirma rollback |
| Limite no backend | atende | `usuarios.limite_cents`; saldo recalculado dentro de `BEGIN IMMEDIATE` |
| Histórico completo a cada turno | atende | `toHistory` preserva mensagens, chamadas de tool e resultados; testes sem truncamento |
| README de execução e modelo | atende | seções “Como rodar” e “Modelo de linguagem” no README raiz |

Os extras de log auditável e testes de jailbreak também estão implementados.

## Verificações executadas

- `npm run check` em `api-auth`: 28 testes, 100% das funções cobertas.
- `npm run check` em `mcp-server`: 52 testes, 99,03% das funções cobertas.
- `npm run check` em `chat-web`: 29 testes, 100% das funções cobertas.
- `npm run build` em `chat-web`: build de produção concluído.
- `node scripts/verify-shared-db.mjs`: os dois serviços resolveram e abriram o
  mesmo arquivo, com escrita por um e leitura pelo outro.
- `mcp-server/scripts/smoke-catalog-intention.mjs`, em banco isolado: passou
  autenticação, identidade de conversa, descoberta, catálogo, intenção,
  compra, schemas e auditoria.

## Correções aplicadas nesta auditoria

1. O smoke test tratava `JWT_SECRET=` como segredo configurado, enquanto os
   servidores tratam a string vazia como ausência e usam o fallback de
   desenvolvimento. O script agora remove espaços e aplica o mesmo fallback.
2. O checklist e a evidência 7 do README ainda descreviam as issues #20 e #21
   como abertas, apesar de as PRs #23 e #25 já terem fechado os schemas e o
   vínculo de conversa. A documentação agora reflete o código atual.

## Plano de acompanhamento

Não há correção bloqueadora restante para os critérios obrigatórios. Restam
ações de qualidade que não mudam o resultado do desafio:

- executar e marcar as verificações manuais ainda abertas nos `tasks.md`
  históricos, especialmente o cenário de recarregar a página da spec 008;
- acrescentar teste de integração automatizado para `POST /api/chat`, hoje
  coberto por testes dos módulos, smoke MCP e roteiro manual;
- eliminar os avisos `MODULE_TYPELESS_PACKAGE_JSON` do test runner do
  `chat-web` em uma mudança própria, depois de confirmar o impacto do modo ESM.

Esses itens não devem ser implementados silenciosamente dentro deste fix: o
primeiro exige execução humana no navegador, e os outros ampliam o escopo e
devem seguir o fluxo `grill-me → to-spec → tasks` se forem priorizados.
