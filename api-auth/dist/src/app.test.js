import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { app, initSchema } from "./app.js";
import { getDb } from "./db.js";
import jwt from "jsonwebtoken";
// Usa database em memória pra não poluir dados reais
process.env.DATABASE_PATH = ":memory:";
let server;
let serverUrl;
// Setup: inicia servidor antes de cada suite
async function setupServer() {
    const db = getDb();
    db.exec("DROP TABLE IF EXISTS usuarios");
    initSchema();
    server = createServer(app);
    return new Promise((resolve) => {
        server.listen(0, "localhost", () => {
            const addr = server.address();
            if (addr && typeof addr === "object") {
                serverUrl = `http://localhost:${addr.port}`;
            }
            resolve();
        });
    });
}
// Teardown: fecha servidor
async function teardownServer() {
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}
/**
 * Helper: faz requisição HTTP e retorna status + body
 */
async function request(method, path, body, headers) {
    const url = new URL(path, serverUrl);
    const opts = {
        method,
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
    };
    const res = await fetch(url, {
        ...opts,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return {
        status: res.status,
        body: text ? JSON.parse(text) : null,
    };
}
test("Cadastro", async (t) => {
    await setupServer();
    await t.test("novo usuário com CPF válido", async () => {
        const res = await request("POST", "/auth/cadastro", {
            nome: "Alice",
            cpf: "12345678901",
            senha: "senha123",
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.message, "cadastro realizado");
    });
    await t.test("rejeita CPF duplicado", async () => {
        await request("POST", "/auth/cadastro", {
            nome: "Alice",
            cpf: "12345678901",
            senha: "senha123",
        });
        const res = await request("POST", "/auth/cadastro", {
            nome: "Bob",
            cpf: "12345678901",
            senha: "outraSenha",
        });
        assert.equal(res.status, 400);
        assert.match(res.body.error, /CPF já cadastrado/);
    });
    await t.test("rejeita nome vazio", async () => {
        const res = await request("POST", "/auth/cadastro", {
            nome: "",
            cpf: "12345678902",
            senha: "senha123",
        });
        assert.equal(res.status, 400);
    });
    await t.test("rejeita CPF vazio", async () => {
        const res = await request("POST", "/auth/cadastro", {
            nome: "Alice",
            cpf: "",
            senha: "senha123",
        });
        assert.equal(res.status, 400);
    });
    await t.test("rejeita senha vazia", async () => {
        const res = await request("POST", "/auth/cadastro", {
            nome: "Alice",
            cpf: "12345678903",
            senha: "",
        });
        assert.equal(res.status, 400);
    });
    await teardownServer();
});
test("Login", async (t) => {
    await setupServer();
    await t.test("com credenciais corretas", async () => {
        await request("POST", "/auth/cadastro", {
            nome: "Alice",
            cpf: "12345678901",
            senha: "senha123",
        });
        const res = await request("POST", "/auth/login", {
            cpf: "12345678901",
            senha: "senha123",
        });
        assert.equal(res.status, 200);
        assert.equal(typeof res.body.token, "string");
        assert.equal(res.body.cpf, "12345678901");
        assert.equal(res.body.nome, "Alice");
        assert.equal(res.body.expiresIn, "1h");
        // Valida JWT
        const JWT_SECRET = process.env.JWT_SECRET || "workshop-dev-secret-do-not-use-in-prod";
        const decoded = jwt.verify(res.body.token, JWT_SECRET);
        assert.equal(decoded.sub, "12345678901");
        assert.equal(decoded.role, undefined); // sem role
        assert.equal(decoded.limite_cents, undefined); // sem limite no payload
    });
    await t.test("rejeita CPF inexistente", async () => {
        const res = await request("POST", "/auth/login", {
            cpf: "naoexiste",
            senha: "qualquer",
        });
        assert.equal(res.status, 401);
        assert.match(res.body.error, /CPF ou senha inválidos/);
    });
    await t.test("rejeita senha errada", async () => {
        await request("POST", "/auth/cadastro", {
            nome: "Alice",
            cpf: "12345678902",
            senha: "senha123",
        });
        const res = await request("POST", "/auth/login", {
            cpf: "12345678902",
            senha: "senhaErrada",
        });
        assert.equal(res.status, 401);
        assert.match(res.body.error, /CPF ou senha inválidos/);
    });
    await t.test("rejeita CPF/senha vazio", async () => {
        const res = await request("POST", "/auth/login", {
            cpf: "",
            senha: "",
        });
        assert.equal(res.status, 400);
    });
    await teardownServer();
});
test("GET /usuarios/me/limite", async (t) => {
    await setupServer();
    await t.test("retorna limite com JWT válido", async () => {
        await request("POST", "/auth/cadastro", {
            nome: "Alice",
            cpf: "12345678901",
            senha: "senha123",
        });
        const loginRes = await request("POST", "/auth/login", {
            cpf: "12345678901",
            senha: "senha123",
        });
        const res = await request("GET", "/usuarios/me/limite", undefined, {
            Authorization: `Bearer ${loginRes.body.token}`,
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.limite_cents, 100000);
    });
    await t.test("rejeita sem JWT", async () => {
        const res = await request("GET", "/usuarios/me/limite");
        assert.equal(res.status, 401);
    });
    await t.test("rejeita JWT inválido", async () => {
        const res = await request("GET", "/usuarios/me/limite", undefined, {
            Authorization: "Bearer token_invalido",
        });
        assert.equal(res.status, 401);
    });
    await t.test("rejeita JWT de usuário inexistente", async () => {
        const JWT_SECRET = process.env.JWT_SECRET || "workshop-dev-secret-do-not-use-in-prod";
        const fakeToken = jwt.sign({}, JWT_SECRET, { subject: "cpf_inexistente", expiresIn: "1h" });
        const res = await request("GET", "/usuarios/me/limite", undefined, {
            Authorization: `Bearer ${fakeToken}`,
        });
        assert.equal(res.status, 404);
    });
    await teardownServer();
});
test("Health check", async (t) => {
    await setupServer();
    await t.test("retorna status ok", async () => {
        const res = await request("GET", "/health");
        assert.equal(res.status, 200);
        assert.equal(res.body.status, "ok");
    });
    await teardownServer();
});
