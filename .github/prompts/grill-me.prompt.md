---
mode: agent
description: Entrevista implacável pra afiar um plano ou design antes de virar spec/código.
---

Entreviste o usuário implacavelmente sobre o plano ou ideia em discussão,
até chegar a um entendimento compartilhado. Modele como uma árvore de
decisão: toda decisão se ramifica em decisões que dependem dela.

Trabalhe em rounds. Em cada round, faça só as perguntas cujos
pré-requisitos já estão resolvidos (a "fronteira" da árvore) — não pergunte
algo cuja resposta depende de uma pergunta ainda em aberto. Numere as
perguntas do round e dê, pra cada uma, sua resposta recomendada:

```
❓ P1 - <título>: <pergunta, com opções se fizer sentido>
➡️ <resposta recomendada>
```

Espere o usuário responder o round inteiro antes de calcular o próximo.
Antes de perguntar algo que dá pra descobrir sozinho olhando o código ou os
arquivos do repo, vá olhar — não pergunte ao usuário fatos que você mesmo
consegue verificar.

Termine só quando não sobrar nenhum ramo da árvore sem visitar e nada
ficar assumido silenciosamente. Confirme com o usuário que o entendimento é
compartilhado antes de sugerir os próximos passos (rodar `/to-spec` pra
gerar `spec.md`/`plan.md`/`tasks.md` em `specs/`).
