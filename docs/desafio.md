# Desafio — Chatbot com Tools MCP de Pagamentos

**Trilha de Pagamentos Agênticos · Hands-on de agentes e MCP**

Construir um chatbot que conversa com um LLM e executa **compras reais (simuladas)** através de ferramentas expostas via MCP.

Você pode usar **qualquer linguagem e qualquer modelo gratuito**. Ollama local (Llama, Qwen, Mistral), ou APIs gratuitas na nuvem (NVIDIA NIM, OpenRouter, etc.).

---

## O que construir

Uma aplicação **local**, com **frontend** e **backend**, onde o usuário faz login, conversa com o agente em linguagem natural e consegue comprar um produto do catálogo.

```
Frontend (chat)  →  Backend (auth + agente + MCP client)  →  Servidor MCP (3 tools)
```

---

## Requisitos obrigatórios

### 1. As três tools MCP

O contrato abaixo é o mínimo esperado. Os nomes dos campos podem variar, desde que a semântica e a tipagem sejam mantidas.

---

#### `listar_catalogo`

Retorna os produtos disponíveis.

**Argumentos**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `categoria` | `string` | não | Filtro opcional por categoria. |

**Retorno**

```ts
{
  produtos: Array<{
    id: string;        // "prod_003"
    nome: string;      // "Fone Bluetooth"
    preco: number;     // 249.90
    moeda: string;     // "BRL"
    estoque: number;   // 12
  }>
}
```

---

#### `registrar_intencao`

Registra a intenção de compra de um item e devolve um identificador. **Nenhum dinheiro se move aqui.**

**Argumentos**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `produto_id` | `string` | sim | Deve existir no catálogo. |
| `quantidade` | `number` (int > 0) | sim | Quantidade desejada. |

**Retorno**

```ts
{
  intencao_id: string;    // "int_a1b2c3", gerado pelo backend
  produto_id: string;
  quantidade: number;
  valor_total: number;    // calculado no backend, não enviado pelo cliente
  moeda: string;          // "BRL"
  status: "pendente";
  expira_em: string;      // ISO 8601
}
```

---

#### `realizar_compra`

Executa a compra **a partir de uma intenção previamente registrada**.

**Argumentos**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `intencao_id` | `string` | **sim** | Identificador retornado por `registrar_intencao`. |
| `metodo_pagamento` | `"cartao" \| "pix"` | sim | Método escolhido pelo usuário. |

> O **valor não é argumento**. Ele vem da intenção registrada, assim o modelo não consegue inventar ou alterar o preço.

**Retorno (sucesso)**

```ts
{
  status: "aprovado";
  transacao_id: string;     // "tx_9f8e7d"
  intencao_id: string;
  valor: number;
  metodo_pagamento: "cartao" | "pix";
  limite_restante: number;  // saldo do usuário após a compra
  data: string;             // ISO 8601
}
```

**Retorno (erro)**

```ts
{
  status: "recusado";
  erro: "INTENCAO_INVALIDA" | "INTENCAO_EXPIRADA" | "INTENCAO_JA_PAGA"
       | "LIMITE_EXCEDIDO" | "METODO_INVALIDO";
  mensagem: string;         // texto legível para o agente explicar ao usuário
}
```

---

### 1.1 Validação da intenção

`realizar_compra` **deve recusar** qualquer `intencao_id` que não tenha sido legitimamente criado por `registrar_intencao` na sessão atual do usuário. Se o modelo inventar um id, repetir um id de outro usuário ou usar um id que não apareceu no histórico da conversa, a tool retorna `INTENCAO_INVALIDA`.

Casos que devem falhar:

| Situação | Erro esperado |
|---|---|
| `intencao_id` inexistente ou inventado pelo modelo | `INTENCAO_INVALIDA` |
| Intenção pertencente a outro usuário | `INTENCAO_INVALIDA` |
| Intenção já utilizada em uma compra | `INTENCAO_JA_PAGA` |
| Intenção fora do prazo de validade | `INTENCAO_EXPIRADA` |
| Valor da intenção acima do limite do usuário | `LIMITE_EXCEDIDO` |

> O backend é a fonte da verdade: ele guarda as intenções emitidas e só aceita as que ele mesmo criou. Não confie no que vem no argumento.

### 2. Autenticação
- O chat só pode ser acessado por usuário autenticado (login/senha, token — sua escolha).
- Cada usuário tem um **limite de gasto definido no backend** (não no frontend, não no prompt).

### 3. Métodos de pagamento
- `realizar_compra` deve aceitar **pelo menos dois métodos**: `cartao` e `pix`.

### 4. Regra de limite
- Se a compra exceder o limite do usuário, a tool deve **retornar erro** — e o agente deve comunicar isso ao usuário em linguagem natural.
- A validação é responsabilidade do **backend**. O modelo não pode ser a única barreira.

### 5. Histórico completo
- Todo o histórico da conversa deve ser enviado ao agente a cada turno, incluindo as chamadas de ferramenta e seus resultados.

---

## Fluxo esperado

1. Usuário faz login.
2. *"O que vocês têm à venda?"* → agente chama `listar_catalogo`.
3. *"Quero o item 3."* → agente chama `registrar_intencao`.
4. *"Pode pagar no pix."* → agente chama `realizar_compra`.
5. Se estourar o limite → erro tratado e explicado pelo agente.

---

## Critérios de conclusão

- [ ] Frontend e backend rodando localmente.
- [ ] Login funcionando; chat inacessível sem autenticação.
- [ ] Servidor MCP com as 3 tools expostas e sendo descobertas pelo agente.
- [ ] Tools respeitam os contratos de argumentos e retorno especificados.
- [ ] Compra concluída com `cartao` **e** com `pix`.
- [ ] `realizar_compra` exige `intencao_id` válido e recusa id inventado.
- [ ] Tentativa acima do limite retorna erro.
- [ ] Limite armazenado e validado no backend.
- [ ] Histórico completo enviado ao modelo a cada turno.
- [ ] `README.md` com instruções de execução e qual modelo foi usado.

---

## Extras (opcionais)

- Registrar log auditável de cada chamada de tool (quem, quando, quanto, resultado).
- Testar o agente com pedidos maliciosos (*"ignore o limite"*, *"use a intenção int_falsa"*) e verificar que o backend segura. (JailBreak)

---

## Entrega

Link do repositório com o código, o `README.md` e screenshots das execuções:

1. Uma compra bem-sucedida (`cartao` e `pix`).
2. Uma tentativa bloqueada por **limite excedido**.
3. Uma tentativa com **`intencao_id` inválido** sendo recusada.