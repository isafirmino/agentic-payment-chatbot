import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { getDb } from "./db.js";

type Usuario = {
  cpf: string;
  nome: string;
  password_hash: string;
  limite_cents: number;
};

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return timingSafeEqual(expected, actual);
}

const JWT_SECRET =
  process.env.JWT_SECRET || "workshop-dev-secret-do-not-use-in-prod";
const JWT_TTL = "1h";
const DEFAULT_LIMITE_CENTS = Number(process.env.DEFAULT_LIMITE_CENTS) || 100000;

declare global {
  namespace Express {
    interface Request {
      user?: { cpf: string };
    }
  }
}

/**
 * Inicializa schema: cria tabela usuarios se não existir.
 * Chamado no bootstrap de server.ts.
 */
export function initSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      cpf TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      limite_cents INTEGER NOT NULL DEFAULT ${DEFAULT_LIMITE_CENTS}
    )
  `);
}

function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    const claims = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    req.user = { cpf: claims.sub! };
    next();
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime() }),
);

/**
 * POST /auth/cadastro
 * Cadastra novo usuário com nome, CPF e senha.
 * Retorna erro se CPF já existe (PRIMARY KEY constraint).
 */
app.post("/auth/cadastro", (req, res) => {
  const { nome, cpf, senha } = req.body ?? {};

  if (typeof nome !== "string" || !nome.trim()) {
    return res.status(400).json({ error: "nome é obrigatório" });
  }
  if (typeof cpf !== "string" || !cpf.trim()) {
    return res.status(400).json({ error: "cpf é obrigatório" });
  }
  if (typeof senha !== "string" || !senha.trim()) {
    return res.status(400).json({ error: "senha é obrigatória" });
  }

  try {
    const db = getDb();
    const passwordHash = hashPassword(senha);
    db.prepare(
      "INSERT INTO usuarios (cpf, nome, password_hash, limite_cents) VALUES (?, ?, ?, ?)",
    ).run(cpf.trim(), nome.trim(), passwordHash, DEFAULT_LIMITE_CENTS);
    return res.status(201).json({ message: "cadastro realizado" });
  } catch (err: any) {
    // SQLite UNIQUE/PRIMARY KEY constraint error
    if (
      err.message?.includes("UNIQUE constraint failed") ||
      err.message?.includes("PRIMARY KEY")
    ) {
      return res.status(400).json({ error: "CPF já cadastrado" });
    }
    return res.status(500).json({ error: "erro no cadastro" });
  }
});

/**
 * POST /auth/login
 * Autentica usuário com CPF e senha.
 * Retorna JWT com sub=cpf (sem role, sem limite no payload).
 */
app.post("/auth/login", (req, res) => {
  const { cpf, senha } = req.body ?? {};

  if (typeof cpf !== "string" || typeof senha !== "string") {
    return res.status(400).json({ error: "cpf e senha são obrigatórios" });
  }

  try {
    const db = getDb();
    const usuario = db
      .prepare("SELECT cpf, nome, password_hash FROM usuarios WHERE cpf = ?")
      .get(cpf.trim()) as Usuario | undefined;

    if (!usuario || !verifyPassword(senha, usuario.password_hash)) {
      return res.status(401).json({ error: "CPF ou senha inválidos" });
    }

    const token = jwt.sign({}, JWT_SECRET, {
      subject: usuario.cpf,
      expiresIn: JWT_TTL,
    });
    return res.json({
      token,
      cpf: usuario.cpf,
      nome: usuario.nome,
      expiresIn: JWT_TTL,
    });
  } catch (err) {
    return res.status(500).json({ error: "erro no login" });
  }
});

/**
 * GET /usuarios/me/limite
 * Retorna o limite de gasto do usuário autenticado.
 * Requer JWT válido no header Authorization.
 */
app.get("/usuarios/me/limite", authenticate, (req, res) => {
  try {
    const db = getDb();
    const usuario = db
      .prepare("SELECT limite_cents FROM usuarios WHERE cpf = ?")
      .get(req.user!.cpf) as Pick<Usuario, "limite_cents"> | undefined;

    if (!usuario) {
      return res.status(404).json({ error: "usuário não encontrado" });
    }

    return res.json({ limite_cents: usuario.limite_cents });
  } catch (err) {
    return res.status(500).json({ error: "erro ao buscar limite" });
  }
});
