import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
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
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
