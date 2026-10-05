import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Controle de planos e limites (Fase 8.3): fallback de plano, limites
// por quantidade, uso mensal de WhatsApp/IA, dashboard e downgrade.
vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

import { fakeSupabase, type FakeQuery, type FakeResult } from "./helpers/supabase-fake";
import {
  getSubscription,
  getActiveSubscription,
  getClinicPlan,
  getSubscriptionStatus,
  createSubscription,
  updateSubscription,
  hasFeature,
  requireFeature,
  PlanLimitError,
  canAddProfessional,
  canAddAdminUser,
  canAddUnit,
  getWhatsappUsage,
  canSendWhatsapp,
  incrementWhatsappUsage,
  getAiUsage,
  incrementAiUsage,
  getUsageDashboard,
  canDowngradeTo,
} from "@/lib/services/plan-limits";

type Sub = Record<string, unknown>;

const activeSub: Sub = {
  id: "s1",
  clinic_id: 1,
  plan_id: "pro",
  status: "active",
  current_period_start: "2026-10-01 00:00",
  current_period_end: "2026-11-01 00:00",
  cancel_at_period_end: false,
};

interface RouterOpts {
  sub?: Sub | null;
  subError?: { message: string };
  counts?: Record<string, number>;
  countError?: { message: string };
  usage?: Record<string, unknown> | null;
  usageError?: { message: string };
}

function router(opts: RouterOpts) {
  return (q: FakeQuery): FakeResult | void => {
    if (q.table === "subscriptions") {
      if (q.op === "insert") return { data: { ...activeSub, id: "novo" }, error: null };
      if (q.op === "update")
        return { data: { ...(opts.sub ?? activeSub), ...(q.payload as Sub) }, error: null };
      if (opts.subError) return { error: opts.subError };
      // Leitura em lista (getSubscription) devolve array; update/insert
      // usam .maybeSingle()/.single() e recebem a linha (ou null).
      const row = opts.sub ?? null;
      const wantsRow = Boolean(q.opts.single || q.opts.maybeSingle);
      return { data: wantsRow ? row : row ? [row] : [], error: null };
    }
    if (q.table === "clinics") return { data: [{ id: 1 }], error: null };
    if (q.table === "usage") {
      if (q.op === "select") return { data: opts.usage ? [opts.usage] : [], error: opts.usageError ?? null };
      if (q.op === "insert" || q.op === "update") return { data: null, error: null };
      return undefined;
    }
    if (
      (q.table === "professionals" || q.table === "clinic_members" || q.table === "units") &&
      q.opts.head
    ) {
      if (opts.countError) return { error: opts.countError };
      return { count: opts.counts?.[q.table] ?? 0, error: null };
    }
    return undefined;
  };
}

describe("plan-limits (Fase 8.3)", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T10:00:00"));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("assinatura e plano", () => {
    it("getSubscription le a mais recente da clinica e devolve null sem linha", async () => {
      fakeSupabase.setResolver(router({ sub: activeSub }));
      expect(await getSubscription(3)).toEqual(activeSub);
      const q = fakeSupabase.last("subscriptions", "select");
      expect(q?.filters).toContain("clinic_id=3");
      expect(q?.filters).toContain("order:created_at:desc");
      expect(q?.filters).toContain("limit:1");

      fakeSupabase.reset();
      fakeSupabase.setResolver(router({ sub: null }));
      expect(await getSubscription()).toBeNull();
    });

    it("getSubscription com erro de banco reporta e devolve null", async () => {
      fakeSupabase.setResolver(router({ subError: { message: "off" } }));
      expect(await getSubscription()).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it("getActiveSubscription so aceita active/trialing", async () => {
      fakeSupabase.setResolver(router({ sub: { ...activeSub, status: "canceled" } }));
      expect(await getActiveSubscription()).toBeNull();
      fakeSupabase.setResolver(router({ sub: { ...activeSub, status: "trialing" } }));
      expect(await getActiveSubscription()).toEqual(
        expect.objectContaining({ status: "trialing" })
      );
      expect(await getActiveSubscription(99)).toEqual(
        expect.objectContaining({ status: "trialing" })
      );
    });

    it("getClinicPlan cai no Start sem assinatura ativa e usa o plano da assinatura quando ativa", async () => {
      fakeSupabase.setResolver(router({ sub: null }));
      expect((await getClinicPlan()).id).toBe("start");

      fakeSupabase.setResolver(router({ sub: { ...activeSub, plan_id: "pro" } }));
      expect((await getClinicPlan()).id).toBe("pro");
    });

    it("getSubscriptionStatus mapeia para none quando nao ha linha", async () => {
      fakeSupabase.setResolver(router({ sub: null }));
      expect(await getSubscriptionStatus()).toBe("none");
      fakeSupabase.setResolver(router({ sub: activeSub }));
      expect(await getSubscriptionStatus()).toBe("active");
    });

    it("createSubscription grava ativa com defaults e propaga falha do banco", async () => {
      fakeSupabase.setResolver(router({ sub: null }));
      const created = await createSubscription({ clinic_id: 1, plan_id: "start" });
      expect(created).toMatchObject({ id: "novo" });
      const ins = fakeSupabase.last("subscriptions", "insert");
      expect(ins?.payload).toMatchObject({
        clinic_id: 1,
        plan_id: "start",
        status: "active",
        cancel_at_period_end: false,
      });

      fakeSupabase.setResolver((q) =>
        q.table === "subscriptions" && q.op === "insert"
          ? { error: { message: "fk" } }
          : undefined
      );
      await expect(createSubscription({ clinic_id: 1, plan_id: "start" })).rejects.toThrow(
        "Falha ao criar a assinatura: fk"
      );
    });

    it("updateSubscription sem linha devolve null; com linha mescla so o que veio", async () => {
      fakeSupabase.setResolver(router({ sub: null }));
      expect(await updateSubscription("s1", { status: "canceled" })).toBeNull();

      fakeSupabase.reset();
      fakeSupabase.setResolver(router({ sub: activeSub }));
      const updated = await updateSubscription("s1", { status: "past_due" });
      expect(updated).toMatchObject({ status: "past_due", plan_id: "pro" });
      const upd = fakeSupabase.last("subscriptions", "update");
      expect(upd?.payload).toMatchObject({ status: "past_due", plan_id: "pro" });
      expect(upd?.payload).toHaveProperty("updated_at");
    });

    it("updateSubscription com erro de leitura ou de escrita devolve null", async () => {
      fakeSupabase.setResolver((q) =>
        q.table === "subscriptions" && q.op === "select"
          ? { error: { message: "leitura" } }
          : undefined
      );
      expect(await updateSubscription("s1", { status: "canceled" })).toBeNull();

      fakeSupabase.setResolver((q) => {
        if (q.table === "subscriptions" && q.op === "select") return { data: activeSub };
        if (q.table === "subscriptions" && q.op === "update")
          return { error: { message: "escrita" } };
        return undefined;
      });
      expect(await updateSubscription("s1", { status: "canceled" })).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("features por plano", () => {
    it("plano Start tem agenda e nao tem financial_control; requireFeature lança PlanLimitError", async () => {
      fakeSupabase.setResolver(router({ sub: null }));
      expect(await hasFeature(undefined, "agenda")).toBe(true);
      expect(await hasFeature(undefined, "financial_control")).toBe(false);

      const err = await requireFeature(undefined, "financial_control").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PlanLimitError);
      expect((err as PlanLimitError).planName).toBe("Start");
      expect((err as Error).message).toContain("financial_control");
    });

    it("requireFeature libera o recurso presente no plano ativo", async () => {
      fakeSupabase.setResolver(router({ sub: { ...activeSub, plan_id: "business" } }));
      await expect(requireFeature(undefined, "financial_control")).resolves.toBeUndefined();
    });
  });

  describe("limites por quantidade", () => {
    it("canAddProfessional: no limite do Start bloqueia com mensagem; abaixo libera", async () => {
      fakeSupabase.setResolver(router({ sub: null, counts: { professionals: 5 } }));
      const blocked = await canAddProfessional(1);
      expect(blocked).toMatchObject({ allowed: false, current: 5, limit: 5, remaining: 0 });
      expect(blocked.message).toContain("limite de 5 profissionais");

      fakeSupabase.setResolver(router({ sub: null, counts: { professionals: 2 } }));
      const ok = await canAddProfessional(1);
      expect(ok).toMatchObject({ allowed: true, remaining: 3 });
      expect(ok.message).toContain("Pode adicionar 3 profissional(is)");

      const countQuery = fakeSupabase
        .find("professionals", "select")
        .find((q) => q.opts.head === true);
      expect(countQuery?.filters.join(" ")).toContain("status=active");
    });

    it("plano Enterprise tem limites infinitos (sempre libera, mensagem de personalizado)", async () => {
      fakeSupabase.setResolver(
        router({ sub: { ...activeSub, plan_id: "enterprise" }, counts: { professionals: 999 } })
      );
      const check = await canAddProfessional(1);
      expect(check.allowed).toBe(true);
      expect(check.limit).toBe(Infinity);
      expect(check.message).toBe("Limite personalizado.");
    });

    it("canAddAdminUser e canAddUnit leem suas tabelas com o filtro active=true", async () => {
      fakeSupabase.setResolver(
        router({ sub: null, counts: { clinic_members: 3, units: 1 } })
      );
      expect((await canAddAdminUser(1)).allowed).toBe(false);
      expect((await canAddUnit(1)).allowed).toBe(false);

      const members = fakeSupabase.find("clinic_members", "select").find((q) => q.opts.head);
      expect(members?.filters.join(" ")).toContain("active=true");
      const units = fakeSupabase.find("units", "select").find((q) => q.opts.head);
      expect(units?.filters.join(" ")).toContain("active=true");
    });

    it("falha ao contar vira 0 (sem excecao) e erro de clinica usa o id 1", async () => {
      fakeSupabase.setResolver((q) => {
        if (q.table === "clinics") return { error: { message: "off" } };
        if (q.opts.head) return { error: { message: "count off" } };
        return router({ sub: null })(q);
      });
      const check = await canAddProfessional();
      expect(check.current).toBe(0);
      expect(console.error).toHaveBeenCalled();
      const countQuery = fakeSupabase
        .find("professionals", "select")
        .find((q) => q.opts.head === true);
      expect(countQuery?.filters).toContain("clinic_id=1");
    });
  });

  describe("uso de WhatsApp e IA", () => {
    it("getWhatsappUsage calcula uso, restante e percentual do periodo corrente", async () => {
      fakeSupabase.setResolver(
        router({ sub: null, usage: { id: "u1", whatsapp_conversations: 480, ai_interactions: 10 } })
      );
      const usage = await getWhatsappUsage(1);
      expect(usage).toMatchObject({
        allowed: true,
        current: 480,
        limit: 500,
        remaining: 20,
        percentage: 96,
        planName: "Start",
      });
      expect(usage.message).toBeUndefined();

      const q = fakeSupabase.last("usage", "select");
      expect(q?.filters).toContain("period=2026-10");
      expect(q?.filters).toContain("clinic_id=1");
    });

    it("no limite do WhatsApp bloqueia com mensagem e canSendWhatsapp acompanha", async () => {
      fakeSupabase.setResolver(
        router({ sub: null, usage: { id: "u1", whatsapp_conversations: 500 } })
      );
      const usage = await getWhatsappUsage();
      expect(usage.allowed).toBe(false);
      expect(usage.remaining).toBe(0);
      expect(usage.message).toContain("Limite de 500 conversas WhatsApp");
      expect(await canSendWhatsapp()).toBe(false);
    });

    it("incrementWhatsappUsage atualiza a linha existente ou cria a primeira", async () => {
      fakeSupabase.setResolver(
        router({ sub: null, usage: { id: "u1", whatsapp_conversations: 7 } })
      );
      await incrementWhatsappUsage(1, 3);
      const upd = fakeSupabase.last("usage", "update");
      expect(upd?.payload).toMatchObject({ whatsapp_conversations: 10 });
      expect(upd?.payload).toHaveProperty("updated_at");

      fakeSupabase.reset();
      fakeSupabase.setResolver(router({ sub: null, usage: null }));
      await incrementWhatsappUsage(1);
      const ins = fakeSupabase.last("usage", "insert");
      expect(ins?.payload).toMatchObject({
        clinic_id: 1,
        period: "2026-10",
        whatsapp_conversations: 1,
        ai_interactions: 0,
      });
    });

    it("getAiUsage/incrementAiUsage fazem o mesmo caminho para interacoes de IA", async () => {
      fakeSupabase.setResolver(
        router({ sub: null, usage: { id: "u1", ai_interactions: 200 } })
      );
      const usage = await getAiUsage();
      expect(usage).toMatchObject({ current: 200, limit: 200, allowed: false });
      expect(usage.message).toContain("Limite de 200 interações IA");

      await incrementAiUsage(1, 5);
      const upd = fakeSupabase.last("usage", "update");
      expect(upd?.payload).toMatchObject({ ai_interactions: 205 });
    });

    it("getUsageDashboard agrega plano + todas as contagens com percentuais", async () => {
      fakeSupabase.setResolver(
        router({
          sub: null,
          counts: { professionals: 5, clinic_members: 3, units: 1 },
          usage: { id: "u1", whatsapp_conversations: 250, ai_interactions: 100 },
        })
      );
      const dash = await getUsageDashboard(1);
      expect(dash.plan).toMatchObject({ id: "start", name: "Start" });
      expect(dash.professionals).toEqual({ current: 5, limit: 5, percentage: 100 });
      expect(dash.adminUsers).toEqual({ current: 3, limit: 3, percentage: 100 });
      expect(dash.units).toEqual({ current: 1, limit: 1, percentage: 100 });
      expect(dash.whatsapp).toEqual({ current: 250, limit: 500, percentage: 50 });
      expect(dash.ai).toEqual({ current: 100, limit: 200, percentage: 50 });
    });
  });

  describe("downgrade", () => {
    it("bloqueia downgrade quando a clinica excede o limite do plano alvo", async () => {
      fakeSupabase.setResolver(
        router({ sub: null, counts: { professionals: 10, clinic_members: 2, units: 1 } })
      );
      const result = await canDowngradeTo("start");
      expect(result.allowed).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain("10 profissionais");
      expect(result.issues[0]).toContain("Start");
    });

    it("libera downgrade quando tudo cabe no plano alvo", async () => {
      fakeSupabase.setResolver(
        router({ sub: null, counts: { professionals: 2, clinic_members: 1, units: 1 } })
      );
      const result = await canDowngradeTo("start");
      expect(result).toEqual({ allowed: true, issues: [] });
    });
  });
});
