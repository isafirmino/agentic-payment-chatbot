---
name: grilling
description: Entrevista o usuário implacavelmente sobre um plano, decisão ou ideia. Use quando o usuário quiser estressar o próprio raciocínio antes de escrever spec/código, ou usar qualquer frase-gatilho de "grill".
---

Entreviste o usuário implacavelmente até chegar a um entendimento
compartilhado. Modele isso como uma **árvore de decisão**: toda decisão se
ramifica nas decisões que dependem dela.

Trabalhe a árvore em **rounds**. A **fronteira** é toda decisão cujos
pré-requisitos já estão resolvidos: as perguntas que dá pra fazer *agora*
sem chutar respostas que ainda não foram dadas. Faça a fronteira inteira num
round só: numere cada pergunta e dê sua resposta recomendada. Depois espere
as respostas do usuário antes do próximo round.

Formate um round assim:

```
❓ **P1** - **<título da pergunta>**: <corpo da pergunta, pode ter vários
parágrafos, incluindo múltiplas opções>

➡️ <sua resposta recomendada>

---

❓ **P2** - **<título da pergunta>**: <corpo da pergunta, pode ter vários
parágrafos, incluindo múltiplas opções>

➡️ <sua resposta recomendada>
```

Cada round, as respostas do usuário remodelam a árvore: decisões resolvidas
empurram a fronteira pra fora e desbloqueiam perguntas que dependiam delas.
Recalcule a fronteira e faça o próximo round. Uma pergunta cuja resposta
depende de outra pergunta ainda aberta neste round pertence a um round
*posterior*, não a este.

Achar **fatos** é seu trabalho, nunca do usuário. Quando uma pergunta da
fronteira precisa de um fato do ambiente (arquivo, código já existente,
convenção do repo), despache um sub-agente pra buscar — não pergunte ao
usuário algo que você mesmo consegue descobrir. Não bloqueie por causa
disso: uma exploração em andamento é um pré-requisito ainda não resolvido,
então só as perguntas que dependem dela esperam o sub-agente responder;
faça o resto da fronteira agora.

A sessão termina quando a fronteira está vazia: todo ramo da árvore de
design foi visitado, nada ficou assumido silenciosamente. Não aja em cima
disso até o usuário confirmar que chegamos a um entendimento compartilhado.

Antes do primeiro round, dê uma olhada em `specs/` (fora `specs/TEMPLATE/`):
se o que está sendo discutido altera ou estende comportamento que uma spec
existente já descreve — não uma feature nova, mas ajuste/extensão de algo
já especificado —, diga isso ao usuário assim que perceber e cite qual
`specs/<NNN>-<slug>/` parece ser. Isso muda o que sai no final: uma emenda
à spec existente, não uma spec nova (critério e mecânica ficam no
`to-spec`). Continue a entrevista normalmente — isso só muda o destino do
resultado, não a forma de perguntar.

Quando a sessão terminar, sugira rodar o skill `to-spec` pra transformar o
que foi decidido em spec nova ou emenda a uma spec existente — não escreva
esses arquivos você mesmo aqui, esse é o trabalho do outro skill.
