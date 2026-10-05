import { NextRequest, NextResponse } from "next/server";

// ── Rate limiting em memoria (best-effort) ───────────────────────────────────
// Janela deslizante simples por chave (IP, e-mail etc.). O estado vive na
// memoria do processo: no Vercel cada instancia tem o seu, entao o teto real
// e `limite x instancias`. Resolve forca bruta de um mesmo conjunto de
// credenciais na pratica; para um teto global exigiria Redis/Upstash ou WAF.
// Trocar a implementacao de `rateLimit()` nao afeta quem ja a utiliza.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Estouro de memoria (fluxo errado de chaves): zera tudo em vez de crescer.
  if (buckets.size > MAX_BUCKETS) buckets.clear();
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/** Consome 1 unidade da chave. `limit` chamadas sao aceitas por `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/** IP do cliente (Vercel preenche x-forwarded-for; fallback local). */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "local";
}

/** Resposta 429 padrao com Retry-After. */
export function tooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Muitas tentativas. Tente novamente em instantes.", retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

/** Zera os buckets (testes). */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}
