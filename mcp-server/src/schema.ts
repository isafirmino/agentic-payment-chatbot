import type { DatabaseSync } from 'node:sqlite'

export const PRODUCTS = [
  { id: 'prod_001', nome: 'Fone Bluetooth', preco_cents: 24990, moeda: 'BRL', estoque: 20, categoria: 'audio' },
  { id: 'prod_002', nome: 'Teclado Mecânico', preco_cents: 45990, moeda: 'BRL', estoque: 15, categoria: 'perifericos' },
  { id: 'prod_003', nome: 'Monitor 27" 144Hz', preco_cents: 189990, moeda: 'BRL', estoque: 8, categoria: 'monitores' },
  { id: 'prod_004', nome: 'Cadeira Gamer', preco_cents: 69990, moeda: 'BRL', estoque: 5, categoria: 'moveis' },
  { id: 'prod_005', nome: 'Mochila pra Notebook', preco_cents: 18990, moeda: 'BRL', estoque: 30, categoria: 'acessorios' },
] as const

export function bootstrapSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      preco_cents INTEGER NOT NULL CHECK (preco_cents >= 0),
      moeda TEXT NOT NULL DEFAULT 'BRL',
      estoque INTEGER NOT NULL CHECK (estoque >= 0),
      categoria TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS intencoes (
      id TEXT PRIMARY KEY,
      produto_id TEXT NOT NULL REFERENCES produtos(id),
      quantidade INTEGER NOT NULL CHECK (quantidade > 0),
      valor_total_cents INTEGER NOT NULL CHECK (valor_total_cents >= 0),
      status TEXT NOT NULL DEFAULT 'pendente',
      owner_cpf TEXT NOT NULL,
      criada_em TEXT NOT NULL,
      expira_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transacoes (
      id TEXT PRIMARY KEY,
      intencao_id TEXT NOT NULL UNIQUE REFERENCES intencoes(id),
      valor_cents INTEGER NOT NULL CHECK (valor_cents >= 0),
      metodo_pagamento TEXT NOT NULL CHECK (metodo_pagamento IN ('cartao', 'pix')),
      owner_cpf TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `)
}
export function seedProducts(db: DatabaseSync): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO produtos (id, nome, preco_cents, moeda, estoque, categoria)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const product of PRODUCTS) {
    insert.run(product.id, product.nome, product.preco_cents, product.moeda, product.estoque, product.categoria)
  }
}
