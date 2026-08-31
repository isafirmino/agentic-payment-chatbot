import { app } from "./app.js";
import { getDb } from "./db.ts";

const port = Number(process.env.PORT) || 3000;

// Abre o banco antes de aceitar requisição: caminho inválido derruba o boot
// em vez de falhar no meio de um login.
getDb();

app.listen(port, () => console.log(`payments api on http://localhost:${port}`));
