# Tarefas — Documentação de entrega, teste manual e evidências

## Script de auditoria

- [x] Criar `scripts/consultar-transacoes.mjs` reaproveitando `resolveDatabasePath`
- [x] Agrupar a saída por CPF com limite, saldo restante e lista de compras
- [x] Tratar banco ausente, tabela ausente e nenhuma compra sem exceção crua

## Configuração

- [ ] Comentar alternativas de modelo no `chat-web/.env.example` sem trocar o valor padrão

## Roteiro de teste manual

- [ ] Criar `docs/teste-manual.md` com pré-requisitos e ordem de subida dos serviços
- [ ] Descrever a sessão contínua com dados exatos e saldo esperado a cada passo
- [ ] Indicar em cada passo qual captura ele gera e o que precisa estar visível
- [ ] Acrescentar a seção final com os três prompts de jailbreak

## README da raiz

- [ ] Criar `README.md` com fluxo, pré-requisitos e execução dos três serviços
- [ ] Consolidar a tabela de variáveis de ambiente e destacar as compartilhadas
- [ ] Declarar provedor e modelo usados, referenciando o ADR 0002
- [ ] Montar a tabela de conformidade com o checklist do `docs/desafio.md`
- [ ] Documentar a tabela `transacoes` como log auditável e o script de consulta
- [ ] Embutir as sete evidências com legenda explicando o que cada uma prova

## Execução e captura

- [ ] Instalar Ollama, baixar `qwen2.5:7b` e criar os três `.env`
- [ ] Subir os três serviços e confirmar que respondem nas portas 3001, 4000 e 3000
- [ ] Executar o roteiro completo, do cadastro à recusa por `intencao_id` inválido
- [ ] Gravar `01-compra-aprovada-cartao.png` e `02-compra-aprovada-pix.png`
- [ ] Gravar `03-limite-excedido.png` e `04-intencao-invalida.png`
- [ ] Gravar as três capturas de jailbreak (`05`, `06`, `07`)
- [ ] Conferir cada imagem: painel fixado, código de erro legível, sem dado sensível

## Verificação

- [ ] Rodar `npm run check` no `chat-web`
- [ ] Rodar `node scripts/verify-shared-db.mjs`
- [ ] Rodar `node scripts/consultar-transacoes.mjs` com o banco da sessão gravada
- [ ] Conferir a tabela de conformidade linha a linha contra o `docs/desafio.md`
- [ ] Confirmar que as imagens renderizam na pré-visualização do README
- [ ] Rodar `pr-review` antes do PR
