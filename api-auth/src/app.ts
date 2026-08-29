import express, { type Request, type Response, type NextFunction } from "express";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";

type Role = "user" | "admin";
type User = { username: string; passwordHash: string; role: Role };
type Payment = { id: string; owner: string; amount: number; currency: string; description: string; createdAt: string };

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

const users: User[] = [
  { username: "alice", passwordHash: hashPassword("alice123"), role: "user" },
  { username: "bob", passwordHash: hashPassword("bob123"), role: "user" },
  { username: "root", passwordHash: hashPassword("root123"), role: "admin" },
];

const JWT_SECRET = process.env.JWT_SECRET || "workshop-dev-secret-do-not-use-in-prod";
const JWT_TTL = "1h";

const payments = new Map<string, Payment>();

declare global {
  namespace Express {
    interface Request {
      user?: { username: string; role: Role };
    }
  }
}

function login(role: Role) {
  return (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "username and password are required" });
    }
    const user = users.find((u) => u.username === username && u.role === role);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = jwt.sign({ role: user.role }, JWT_SECRET, { subject: user.username, expiresIn: JWT_TTL });
    res.json({ token, username: user.username, role: user.role, expiresIn: JWT_TTL });
  };
}

function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    const claims = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    req.user = { username: claims.sub!, role: claims.role };
    next();
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "admin only" });
  next();
}

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.post("/auth/login", login("user"));
app.post("/auth/admin/login", login("admin"));

app.post("/payments", authenticate, (req, res) => {
  const { amount, currency = "BRL", description = "" } = req.body ?? {};
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (typeof currency !== "string" || typeof description !== "string") {
    return res.status(400).json({ error: "currency and description must be strings" });
  }
  const payment: Payment = {
    id: randomUUID(),
    owner: req.user!.username,
    amount,
    currency,
    description,
    createdAt: new Date().toISOString(),
  };
  payments.set(payment.id, payment);
  res.status(201).json(payment);
});

app.get("/payments", authenticate, adminOnly, (_req, res) => {
  res.json({ payments: [...payments.values()] });
});

app.get("/payments/:id", authenticate, (req, res) => {
  const payment = payments.get(String(req.params.id));
  if (!payment || (req.user!.role !== "admin" && payment.owner !== req.user!.username)) {
    return res.status(404).json({ error: "payment not found" });
  }
  res.json(payment);
});
