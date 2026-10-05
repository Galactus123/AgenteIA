import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// ── Content-Security-Policy (9.1) ───────────────────────────────────────────
// Estratégia: CSP estática no config (sem nonce), porque nonce por request
// só é possível no proxy e força render dinâmico em TODAS as rotas —
// desligaria o pré-render das 7 páginas públicas (login, landing, precos,
// teste-gratis...). O browser só chama a própria origem (/api/*; todo acesso
// à Supabase é server-side), então `connect-src 'self'` é suficiente: se um
// cliente Supabase/terceiro for usado no browser no futuro, adicionar a
// origem aqui (quebrará em dev se esquecer — é proposital).
const csp = [
  "default-src 'self'",
  // 'unsafe-inline': next-themes injeta <script> inline sem-flag no <head>.
  // 'unsafe-eval' só em dev (source maps do toolchain); build de produção não.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.31.237.171", "localhost:3000"],
  async headers() {
    return [
      // ── Webhooks: CORS restritivo ────────────────────────────────────
      // Apenas a Komunika (api.komunika.site) e a Lojou podem fazer POST.
      // Em dev local, permite localhost para facilitar o desenvolvimento.
      {
        source: "/api/webhooks/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: isProd
              ? "https://api.komunika.site"
              : "*",
          },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, x-komunika-signature, x-lojou-signature",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      // ── Headers de segurança globais ─────────────────────────────────
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
      // ── API rotas: sem cache ─────────────────────────────────────────
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
