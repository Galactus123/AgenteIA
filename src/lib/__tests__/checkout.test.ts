import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", () => ({
  requireAuth: vi.fn(async () => null),
}));

import { POST } from "@/app/api/subscription/checkout/route";
import { LOJOU_PLAN_BY_PRICE_ID } from "@/lib/plans";

// ── Checkout LOJOU: plan_id → ID fixo do produto ───────────────────────────
//
// O checkout e o webhook partilham LOJOU_PLAN_BY_PRICE_ID (src/lib/plans.ts):
// o mesmo ID que gera o URL de pagamento e' o que o webhook usa para gravar
// subscriptions.plan_id. Sem env vars LOJOU_*_PRICE_ID.

function makeRequest(planId: unknown): NextRequest {
  return new NextRequest("https://syncbot.test/api/subscription/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ planId }),
  });
}

describe("Checkout LOJOU — IDs fixos de produto", () => {
  it("gera o URL de pagamento com o ID fixo de cada plano", async () => {
    const cases: Array<[string, string]> = [
      ["start", "JzRcy"],
      ["pro", "CZqfz"],
      ["business", "CvPAy"],
      ["enterprise", "Z8cWN"],
    ];

    for (const [planId, lojouId] of cases) {
      const res = await POST(makeRequest(planId));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.type).toBe("checkout");
      expect(body.checkoutUrl).toContain(`price_id=${lojouId}`);
      expect(body.plan).toMatchObject({ id: planId });
    }
  });

  it("usa exatamente os IDs do dicionário partilhado com o webhook", async () => {
    const fromDict = Object.entries(LOJOU_PLAN_BY_PRICE_ID);
    expect(fromDict).toHaveLength(4);

    for (const [lojouId, planId] of fromDict) {
      const res = await POST(makeRequest(planId));
      const body = await res.json();
      expect(body.checkoutUrl).toContain(`price_id=${lojouId}`);
    }
  });

  it("enterprise também gera checkout com o produto fixo Z8cWN", async () => {
    const res = await POST(makeRequest("enterprise"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("checkout");
    expect(body.checkoutUrl).toContain("price_id=Z8cWN");
  });

  it("plano inválido é rejeitado com 400", async () => {
    const res = await POST(makeRequest("gratuito"));

    expect(res.status).toBe(400);
  });
});
