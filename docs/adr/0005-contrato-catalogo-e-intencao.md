# 0005 — Armazenar valores em centavos e estruturar erros de intenção

Status: aceita

## Contexto

As tools `listar_catalogo` e `registrar_intencao` introduzem dados que serão
consumidos pelo agente e, depois, pela tool `realizar_compra` da task #8. O
contrato público usa valores em reais, mas o banco precisa calcular totais e
permitir comparações exatas de limite. A task também exige recusas previsíveis
para produto, quantidade e estoque, embora o contrato mínimo do desafio não
fixe o formato desses erros em `registrar_intencao`.

O CPF autenticado segue o contrato fechado pela task #5: JWT HS256 com o CPF
em `sub`. O limite não viaja no token e nenhuma identidade é aceita nos
argumentos das tools.

## Decisão

Valores monetários são persistidos como `INTEGER` de centavos e convertidos
para reais somente na resposta das tools. Erros esperados de
`registrar_intencao` usam `{ status: "recusado", erro, mensagem }`, com os
códigos `PRODUTO_INEXISTENTE`, `QUANTIDADE_INVALIDA` e
`ESTOQUE_INSUFICIENTE`.

Todas as chamadas MCP exigem Bearer JWT válido. O servidor extrai o
proprietário de `sub`; `owner_cpf` não possui foreign key para `usuarios`
porque as tasks #5 e #7 podem ser desenvolvidas e inicializadas
independentemente.

## Alternativas consideradas

- **Armazenar dinheiro como `REAL`** — descartada porque somas e comparações
  de ponto flutuante podem produzir resultados imprecisos no limite da task
  #8.
- **Deixar Zod rejeitar toda quantidade inválida** — descartada porque o
  agente precisa distinguir `QUANTIDADE_INVALIDA` dos demais erros esperados.
- **Usar foreign key de `owner_cpf` para `usuarios`** — descartada nesta task
  porque faria o bootstrap do MCP depender da tabela que pertence à task #5.
- **Aceitar identidade por header de desenvolvimento** — descartada porque
  criaria um segundo contrato de autenticação não previsto nas tasks.

## Consequências

- A task #8 deve continuar usando centavos em intenções, transações e
  limite, convertendo apenas nas bordas.
- O agente recebe erros estáveis e pode explicar recusas sem interpretar
  exceções genéricas do protocolo.
- O banco não garante sozinho que `owner_cpf` existe em `usuarios`; essa
  garantia vem da assinatura do JWT.
- Alterar o preço seedado depois que o produto já existe não o sobrescreve.
  Isso preserva estoque e estado local, mas exige limpar/migrar o banco para
  aplicar mudanças futuras de catálogo.
