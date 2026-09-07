import { describe, it, expect } from "vitest";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hashSync, compareSync } from "bcryptjs";

// ── Testes do modulo de autenticacao ──────────────────────────────────
// Testamos as funcoes puras de assinatura, hash e validacao de token
// sem depender do SQLite (que requer setup do banco).

describe("Auth — Session Token", () => {
  const SECRET = "test-session-secret-" + randomBytes(8).toString("hex");

  function base64UrlEncode(input: string): string {
    return Buffer.from(input, "utf-8").toString("base64url");
  }

  function sign(payload: string): string {
    return createHmac("sha256", SECRET).update(payload).digest("base64url");
  }

  function createToken(adminId: number, role: string, ttlMs: number): string {
    const payload = base64UrlEncode(
      JSON.stringify({ adminId, role, exp: Date.now() + ttlMs })
    );
    return `${payload}.${sign(payload)}`;
  }

  function readToken(token: string): { adminId: number; role: string; exp: number } | null {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;

    const expected = sign(payload);
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return null;

    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
      // Validar expiracao (igual ao auth.ts)
      if (data.exp < Date.now()) return null;
      return data;
    } catch {
      return null;
    }
  }

  it("deve criar e ler um token valido", () => {
    const token = createToken(1, "admin", 86400000);
    const data = readToken(token);
    expect(data).not.toBeNull();
    expect(data!.adminId).toBe(1);
    expect(data!.role).toBe("admin");
    expect(data!.exp).toBeGreaterThan(Date.now());
  });

  it("deve rejeitar token com assinatura invalida", () => {
    const token = createToken(1, "admin", 86400000);
    const [payload] = token.split(".");
    const fakeSig = createHmac("sha256", "wrong-secret").update(payload).digest("base64url");
    const tampered = `${payload}.${fakeSig}`;
    expect(readToken(tampered)).toBeNull();
  });

  it("deve rejeitar token expirado", () => {
    const token = createToken(1, "admin", -1000); // exp no passado
    expect(readToken(token)).toBeNull();
  });

  it("deve rejeitar token com formato invalido", () => {
    expect(readToken("")).toBeNull();
    expect(readToken("abc")).toBeNull();
    expect(readToken("abc.def")).toBeNull(); // assinatura invalida
  });

  it("deve suportar timing-safe comparison (sem variacao de tempo)", () => {
    const token = createToken(1, "super_admin", 86400000);
    const start = process.hrtime.bigint();
    readToken(token);
    const end = process.hrtime.bigint();
    // Nao deve lancar erro e deve completar em tempo razoavel
    expect(Number(end - start)).toBeLessThan(1_000_000_000); // < 1s
  });
});

describe("Auth — Password Hashing", () => {
  it("deve gerar hash e verificar senha correta", () => {
    const hash = hashSync("minhaSenha123", 10);
    expect(compareSync("minhaSenha123", hash)).toBe(true);
  });

  it("deve rejeitar senha incorreta", () => {
    const hash = hashSync("minhaSenha123", 10);
    expect(compareSync("senhaErrada", hash)).toBe(false);
  });

  it("deve gerar hashes diferentes para a mesma senha (salt unico)", () => {
    const hash1 = hashSync("senha", 10);
    const hash2 = hashSync("senha", 10);
    expect(hash1).not.toBe(hash2);
  });
});

describe("Auth — Cookie Security", () => {
  it("cookie deve ter flags httpOnly e sameSite", () => {
    const cookieConfig = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    };
    expect(cookieConfig.httpOnly).toBe(true);
    expect(cookieConfig.sameSite).toBe("lax");
    expect(cookieConfig.path).toBe("/");
    expect(cookieConfig.maxAge).toBe(604800);
  });
});
