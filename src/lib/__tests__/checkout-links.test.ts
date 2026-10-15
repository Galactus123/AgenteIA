// Sanitização do href de checkout da LOJOU (src/lib/checkout-links.ts).
// Regressão: valores mal colados nas env vars (aspas, quebras de linha,
// domínio sem https://, caminho relativo) tinham de parar de virar href
// inválido — um caminho relativo faz o browser abrir um recurso interno
// (ex.: um chunk .js) em vez da página de checkout.

import { describe, expect, it } from "vitest";
import {
  LOJOU_CHECKOUT_URL,
  getCheckoutLink,
  sanitizeCheckoutUrl,
} from "@/lib/checkout-links";

describe("sanitizeCheckoutUrl", () => {
  it("mantém URLs http(s) válidas intactas", () => {
    expect(sanitizeCheckoutUrl("https://checkout.lojou.com/pay/abc123")).toBe(
      "https://checkout.lojou.com/pay/abc123"
    );
    expect(sanitizeCheckoutUrl("http://checkout.lojou.com/pay/abc")).toBe(
      "http://checkout.lojou.com/pay/abc"
    );
  });

  it("remove aspas e quebras de linha coladas no valor", () => {
    expect(sanitizeCheckoutUrl('"https://checkout.lojou.com/pay/abc"\n')).toBe(
      "https://checkout.lojou.com/pay/abc"
    );
    expect(sanitizeCheckoutUrl("  'https://checkout.lojou.com/pay/x'  ")).toBe(
      "https://checkout.lojou.com/pay/x"
    );
  });

  it("completa https:// em domínios sem protocolo", () => {
    expect(sanitizeCheckoutUrl("checkout.lojou.com/pay/abc")).toBe(
      "https://checkout.lojou.com/pay/abc"
    );
  });

  it("aceita protocolo relativo //dominio", () => {
    expect(sanitizeCheckoutUrl("//checkout.lojou.com/pay/abc")).toBe(
      "https://checkout.lojou.com/pay/abc"
    );
  });

  it("recusa caminhos relativos, nomes de variável e valores vazios", () => {
    expect(sanitizeCheckoutUrl("LINK_DIRETO_LOJOU_START")).toBeNull();
    expect(sanitizeCheckoutUrl("/checkout.js")).toBeNull();
    expect(sanitizeCheckoutUrl("_next/static/chunks/main.js")).toBeNull();
    expect(sanitizeCheckoutUrl("")).toBeNull();
    expect(sanitizeCheckoutUrl(undefined)).toBeNull();
    expect(sanitizeCheckoutUrl("ftp://checkout.lojou.com/pay")).toBeNull();
  });
});

describe("getCheckoutLink", () => {
  it("devolve o link oficial do projeto para os 4 planos da tabela", () => {
    expect(LOJOU_CHECKOUT_URL).toBe("https://pay.lojou.app/KMPZe");
    for (const id of ["start", "pro", "business", "enterprise"] as const) {
      expect(getCheckoutLink(id)).toBe(LOJOU_CHECKOUT_URL);
    }
  });
});
