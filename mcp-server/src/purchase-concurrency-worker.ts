import { parentPort, workerData } from 'node:worker_threads'
import { DatabaseSync } from 'node:sqlite'
import { realizarCompra } from './tools.ts'

type PurchaseWorkerData = {
  databasePath: string
  ownerCpf: string
  intentionId: string
  conversaId: string
  now: string
}

const { databasePath, ownerCpf, intentionId, conversaId, now } = workerData as PurchaseWorkerData
const db = new DatabaseSync(databasePath)
db.exec('PRAGMA busy_timeout = 5000')
db.exec('PRAGMA foreign_keys = ON')

try {
  const result = realizarCompra(
    db,
    ownerCpf,
    conversaId,
    { intencao_id: intentionId, metodo_pagamento: 'pix' },
    new Date(now),
  )
  parentPort?.postMessage(result)
} finally {
  db.close()
}
