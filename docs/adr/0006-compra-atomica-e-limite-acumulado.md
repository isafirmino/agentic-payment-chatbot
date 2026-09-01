# 0006 — Serialize compras e acumule o limite no backend

Status: aceita

## Contexto

A tool `realizar_compra` precisa transformar uma intenção pendente em compra
sem confiar em valor, propriedade ou limite informados pelo modelo. O limite do
usuário está na tabela `usuarios`, enquanto intenções e produtos pertencem ao
servidor MCP no mesmo SQLite, conforme os ADRs 0003, 0004 e 0005.

Uma checagem comum de "ler e depois gravar" permite duas falhas sob
concorrência: duas chamadas podem pagar a mesma intenção, e duas intenções
diferentes podem calcular o mesmo saldo antes de juntas ultrapassarem o limite.
Além disso, inserir a transação, reduzir o estoque e marcar a intenção em etapas
independentes deixaria estado parcial se uma delas falhasse.

O projeto é local e terá uso simples, mas a cobrança duplicada e a validação de
limite são invariantes centrais do backend. A solução deve continuar pequena e
usar a conexão SQLite já adotada, sem serviço ou dependência adicional.

## Decisão

Executar toda compra sob `BEGIN IMMEDIATE`, incluindo validações, cálculo do
limite e efeitos, e persistir transação, estoque e status da intenção numa única
transação SQL.

O limite restante é `usuarios.limite_cents` menos a soma acumulada de todas as
transações daquele CPF, sem reset. `transacoes.intencao_id` é obrigatório e
único; uma violação dessa unicidade é traduzida para `INTENCAO_JA_PAGA` depois
do rollback.

## Alternativas consideradas

- **Validar antes de abrir a transação e confiar somente no status da
  intenção** — permitiria duas chamadas observarem o mesmo estado pendente e o
  mesmo limite antes de gravar, abrindo cobrança duplicada e estouro de saldo.
- **Usar somente `UNIQUE(intencao_id)` com transação diferida** — impediria a
  duplicidade da mesma intenção, mas não protegeria o limite contra compras
  concorrentes de intenções distintas.
- **Manter um saldo mutável em `usuarios`** — tornaria a leitura barata, mas
  duplicaria uma informação derivável, exigiria mais uma atualização atômica e
  perderia a tabela de transações como fonte auditável do gasto.
- **Consultar o limite pela API de autenticação** — acrescentaria uma chamada
  de rede e não tornaria o cálculo e a gravação atômicos. O banco compartilhado
  já foi escolhido no ADR 0003 justamente para essa integração.

## Consequências

- Compras ficam serializadas por escritor no SQLite. Isso é adequado ao uso
  local e simples, mas limita vazão caso o sistema passe a atender carga real.
- Toda validação de propriedade, status, prazo, método e limite usa estado
  fresco do backend dentro da mesma seção crítica dos efeitos.
- A segunda tentativa da mesma intenção normalmente observa o status pago
  depois de aguardar o lock; a restrição única continua como defesa em
  profundidade e protege outros caminhos de escrita futuros.
- Somar o histórico de transações a cada compra é simples e auditável no volume
  esperado. Se o volume crescer, um índice por CPF ou um saldo materializado
  deverá ser avaliado.
- O limite nunca volta automaticamente. Reset periódico, estorno e reembolso
  exigirão uma nova decisão de negócio e não podem ser inferidos desta política.
- Estoque continua sem reserva ou revalidação no pagamento, conforme o escopo
  da task. Qualquer falha de integridade nessa atualização aborta toda a compra.
