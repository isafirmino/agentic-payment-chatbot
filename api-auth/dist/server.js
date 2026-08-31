import { app, initSchema } from "./app.js";
import { getDb } from "./db.js";
const port = Number(process.env.PORT) || 3001;
// Abre o banco antes de aceitar requisição: caminho inválido derruba o boot
// em vez de falhar no meio de um login. Também inicializa o schema.
getDb();
initSchema();
app.listen(port, () => console.log(`payments api on http://localhost:${port}`));
