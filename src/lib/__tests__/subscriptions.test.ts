import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Assinaturas e cota de IA (Fase 8.3): leitura de uso, bloqueio por
// cota, alerta de 80%, ciclo de faturamento e compra de pacote excedente.
vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

vi.mock("@/lib/services/komunika", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/komunika")>();
  return { ...actual, sendKomunikaMessage: vi.fn() };
});

import { fakeSupabase, type FakeQuery, type FakeResult } from "./helpers/supabase-fake";
import { sendKomunikaMessage } from "@/lib/services/komunika";
import type { Clinic } from "@/lib/types";
import {
  getSubscription,
  hasAiQuota,
  consumeTokens,
  blockForQuota,
  createAlert,
  listAlerts,
  notifyReception,
  buyOveragePack,
  runSubscriptionCycleCheck,
  resetSubscriptionCycle,
  OVERAGE_PACK_TOKENS,
  OVERAGE_PACK_PRICE_MZN,
} from "@/lib/services/subscriptions";

const send = vi.mocked(sendKomunikaMessage);

const clinic: Clinic = {
  id: 1,
  name: "Clinica Central",
  address: "Av. 123",
  phone: "+258 84 111 2222",
  whatsapp: "+258841112222",
  opening_hours: "",
  location: "",
  social_media: "",
  token_limit: 1000,
  base_token_limit: 1000,
  current_token_usage: 500,
  near_limit_notified: 0,
  overage_blocks_purchased: 0,
  subscription_status: "active",
  billing_cycle_day: 5,
  last_reset_at: null,
};

interface RouterOpts {
  clinic?: Clinic | null;
  clinicsUpdateError?: { message: string };
  billingError?: { message: string };
  alertError?: { message: string };
}

function router(opts: RouterOpts = {}) {
  return (q: FakeQuery): FakeResult | void => {
    if (q.table === "clinics") {
      if (q.op === "select") return { data: opts.clinic ?? null, error: null };
      return { data: null, error: opts.clinicsUpdateError ?? null };
    }
    if (q.table === "clinic_alerts") {
      if (q.op === "insert")
        return opts.alertError
          ? { error: opts.alertError }
          : { data: { id: 1, ...(q.payload as Record<string, unknown>) }, error: null };
      if (q.op === "select")
        return {
          data: [{ id: 1, type: "cycle_reset", message: "m", created_at: "2026-10-01 00:00" }],
          error: null,
        };
      return { data: null, error: null };
    }
    if (q.table === "billing_events") {
      if (q.op === "insert")
        return opts.billingError ? { error: opts.billingError } : { data: { id: 42 }, error: null };
      return { data: null, error: null };
    }
    return undefined;
  };
}

describe("subscriptions (Fase 8.3)", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    send.mockReset();
    send.mockResolvedValue({ ok: true, status: 200 });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T10:00:00"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("getSubscription / cota", () => {
    it("calcula usagePercent, quotaExhausted e nearLimit", async () => {
      fakeSupabase.setResolver(router({ clinic }));
      const info = await getSubscription();
      expect(info).toMatchObject({ usagePercent: 50, quotaExhausted: false, nearLimit: false });

      fakeSupabase.setResolver(router({ clinic: { ...clinic, current_token_usage: 900 } }));
      expect(await getSubscription()).toMatchObject({ usagePercent: 90, nearLimit: true });

      fakeSupabase.setResolver(router({ clinic: { ...clinic, current_token_usage: 1000 } }));
      expect(await getSubscription()).toMatchObject({ usagePercent: 100, quotaExhausted: true });

      fakeSupabase.setResolver(
        router({ clinic: { ...clinic, current_token_usage: 5000, token_limit: 1000 } })
      );
      expect(await getSubscription()).toMatchObject({ usagePercent: 100 });

      fakeSupabase.setResolver(router({ clinic: { ...clinic, token_limit: 0 } }));
      expect(await getSubscription()).toMatchObject({ usagePercent: 0 });

      fakeSupabase.setResolver(router({ clinic: null }));
      expect(await getSubscription()).toBeNull();
    });

    it("hasAiQuota libera so com espaco na cota (e nega sem clinica)", async () => {
      fakeSupabase.setResolver(router({ clinic: { ...clinic, current_token_usage: 999 } }));
      expect(await hasAiQuota()).toBe(true);

      fakeSupabase.setResolver(router({ clinic: { ...clinic, current_token_usage: 1000 } }));
      expect(await hasAiQuota()).toBe(false);

      fakeSupabase.setResolver(router({ clinic: null }));
      expect(await hasAiQuota()).toBe(false);
    });
  });

  describe("consumeTokens", () => {
    it("abaixo dos 80% atualiza so o consumo, sem alerta", async () => {
      fakeSupabase.setResolver(router({ clinic }));
      const result = await consumeTokens(50);

      expect(result.nearLimitAlert).toBe(false);
      const upd = fakeSupabase.last("clinics", "update");
      expect(upd?.payload).toMatchObject({ current_token_usage: 550 });
      expect(upd?.payload).not.toHaveProperty("near_limit_notified");
      expect(upd?.payload).not.toHaveProperty("subscription_status");
      expect(fakeSupabase.find("clinic_alerts", "insert")).toHaveLength(0);
      expect(result.clinic).toMatchObject({ id: 1 });
    });

    it("cruzando 80% dispara o alerta uma vez (marca near_limit_notified)", async () => {
      fakeSupabase.setResolver(router({ clinic: { ...clinic, current_token_usage: 750 } }));
      const result = await consumeTokens(100);

      expect(result.nearLimitAlert).toBe(true);
      expect(fakeSupabase.last("clinics", "update")?.payload).toMatchObject({
        current_token_usage: 850,
        near_limit_notified: 1,
      });
      const alert = fakeSupabase.last("clinic_alerts", "insert");
      expect(alert?.payload).toMatchObject({ clinic_id: 1, type: "near_limit" });
    });

    it("ja notificado nao repete o alerta de 80%", async () => {
      fakeSupabase.setResolver(
        router({ clinic: { ...clinic, current_token_usage: 750, near_limit_notified: 1 } })
      );
      const result = await consumeTokens(100);

      expect(result.nearLimitAlert).toBe(false);
      expect(fakeSupabase.find("clinic_alerts", "insert")).toHaveLength(0);
    });

    it("estourando a cota muda o status para quota_exhausted (sem alerta de 80%)", async () => {
      fakeSupabase.setResolver(router({ clinic: { ...clinic, current_token_usage: 950 } }));
      const result = await consumeTokens(100);

      expect(result.nearLimitAlert).toBe(false);
      expect(fakeSupabase.last("clinics", "update")?.payload).toMatchObject({
        current_token_usage: 1050,
        subscription_status: "quota_exhausted",
      });
      expect(fakeSupabase.find("clinic_alerts", "insert")).toHaveLength(0);
    });

    it("sem clinica devolve null e nao escreve nada", async () => {
      fakeSupabase.setResolver(router({ clinic: null }));
      expect(await consumeTokens(10)).toEqual({ clinic: null, nearLimitAlert: false });
      expect(fakeSupabase.find("clinics", "update")).toHaveLength(0);
    });
  });

  describe("blockForQuota", () => {
    it("primeira vez: bloqueia, cria alerta e avisa a recepcao no WhatsApp", async () => {
      fakeSupabase.setResolver(router({ clinic }));
      await blockForQuota("849998877");

      expect(fakeSupabase.last("clinics", "update")?.payload).toMatchObject({
        subscription_status: "quota_exhausted",
      });
      const alert = fakeSupabase.last("clinic_alerts", "insert");
      expect(alert?.payload).toMatchObject({ type: "quota_exhausted" });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        clinic.whatsapp,
        expect.stringContaining("849998877"),
        { type: "text" }
      );
    });

    it("ja bloqueado: so reafirma o status, sem alerta novo nem mensagem", async () => {
      fakeSupabase.setResolver(
        router({ clinic: { ...clinic, subscription_status: "quota_exhausted" } })
      );
      await blockForQuota("849998877");

      expect(fakeSupabase.find("clinics", "update")).toHaveLength(1);
      expect(fakeSupabase.find("clinic_alerts", "insert")).toHaveLength(0);
      expect(send).not.toHaveBeenCalled();
    });

    it("sem WhatsApp na clinica: alerta criado, recepcao nao avisada", async () => {
      fakeSupabase.setResolver(router({ clinic: { ...clinic, whatsapp: "" } }));
      await blockForQuota("849998877");

      expect(fakeSupabase.find("clinic_alerts", "insert")).toHaveLength(1);
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("alertes", () => {
    it("createAlert usa a clinica atual e propaga falha do banco", async () => {
      fakeSupabase.setResolver(router({ clinic }));
      const alert = await createAlert("x", "mensagem");
      expect(alert).toMatchObject({ type: "x", message: "mensagem", clinic_id: 1 });

      fakeSupabase.setResolver(router({ clinic, alertError: { message: "off" } }));
      await expect(createAlert("x", "m")).rejects.toThrow("Falha ao criar alerta: off");
      expect(console.error).toHaveBeenCalled();
    });

    it("listAlerts devolve as linhas ou [] em erro", async () => {
      fakeSupabase.setResolver(router({ clinic }));
      expect(await listAlerts(5)).toHaveLength(1);
      const q = fakeSupabase.last("clinic_alerts", "select");
      expect(q?.filters).toContain("order:created_at:desc");
      expect(q?.filters).toContain("limit:5");

      fakeSupabase.setResolver(() => ({ error: { message: "off" } }));
      expect(await listAlerts()).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("notifyReception", () => {
    it("manda para o WhatsApp da recepcao e engole falhas de envio", async () => {
      fakeSupabase.setResolver(router({ clinic }));
      await notifyReception("aviso");
      expect(send).toHaveBeenCalledWith(clinic.whatsapp, "aviso", { type: "text" });

      send.mockRejectedValueOnce(new Error("api caiu"));
      await expect(notifyReception("aviso 2")).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });

    it("sem WhatsApp na clinica nao envia nada", async () => {
      fakeSupabase.setResolver(router({ clinic: { ...clinic, whatsapp: "" } }));
      await notifyReception("aviso");
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("ciclo de faturamento", () => {
    it("sem clinica nao faz nada", async () => {
      fakeSupabase.setResolver(router({ clinic: null }));
      await runSubscriptionCycleCheck();
      expect(fakeSupabase.find("clinics", "update")).toHaveLength(0);
    });

    it("dia diferente do ciclo nao faz nada", async () => {
      fakeSupabase.setResolver(router({ clinic: { ...clinic, billing_cycle_day: 1 } }));
      await runSubscriptionCycleCheck();
      expect(fakeSupabase.find("clinics", "update")).toHaveLength(0);
    });

    it("mes corrente ja resetado nao faz nada", async () => {
      fakeSupabase.setResolver(
        router({ clinic: { ...clinic, last_reset_at: "2026-10-01 02:00" } })
      );
      await runSubscriptionCycleCheck();
      expect(fakeSupabase.find("clinics", "update")).toHaveLength(0);
    });

    it("dia do ciclo + reset vencido: zera consumo, restaura a cota e avisa", async () => {
      fakeSupabase.setResolver(
        router({ clinic: { ...clinic, last_reset_at: "2026-09-30 03:00", current_token_usage: 900 } })
      );
      await runSubscriptionCycleCheck();

      const upd = fakeSupabase.last("clinics", "update");
      expect(upd?.payload).toMatchObject({
        current_token_usage: 0,
        near_limit_notified: 0,
        overage_blocks_purchased: 0,
        token_limit: 1000,
        subscription_status: "active",
        last_reset_at: "2026-10-05 10:00",
      });
      const alert = fakeSupabase.last("clinic_alerts", "insert");
      expect(alert?.payload).toMatchObject({ type: "cycle_reset" });
    });

    it("resetSubscriptionCycle com erro de escrita reporta e nao cria alerta", async () => {
      fakeSupabase.setResolver(router({ clinic, clinicsUpdateError: { message: "lock" } }));
      await resetSubscriptionCycle();
      expect(fakeSupabase.find("clinic_alerts", "insert")).toHaveLength(0);
      expect(console.error).toHaveBeenCalledWith(
        "[subscriptions] Falha ao reiniciar o ciclo:",
        "lock"
      );
    });
  });

  describe("buyOveragePack", () => {
    it("sem clinica lança erro", async () => {
      fakeSupabase.setResolver(router({ clinic: null }));
      await expect(buyOveragePack()).rejects.toThrow("Clínica não encontrada.");
    });

    it("aumenta a cota, registra a cobranca, cria alerta e envia o recibo", async () => {
      fakeSupabase.setResolver(router({ clinic: { ...clinic, current_token_usage: 1000 } }));

      const result = await buyOveragePack();

      expect(result.billingEvent).toMatchObject({ id: 42 });
      expect(result.clinic).toMatchObject({ id: 1 });

      const upd = fakeSupabase.last("clinics", "update");
      expect(upd?.payload).toMatchObject({
        token_limit: 1000 + OVERAGE_PACK_TOKENS,
        overage_blocks_purchased: 1,
        subscription_status: "active",
      });

      const billing = fakeSupabase.last("billing_events", "insert");
      expect(billing?.payload).toMatchObject({
        clinic_id: 1,
        type: "overage_pack",
        amount: OVERAGE_PACK_PRICE_MZN,
        currency: "MZN",
        tokens: OVERAGE_PACK_TOKENS,
      });

      expect(fakeSupabase.last("clinic_alerts", "insert")?.payload).toMatchObject({
        type: "overage_pack",
      });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(clinic.whatsapp, expect.any(String), { type: "text" });
    });

    it("preco configuravel via env sobrepoe o padrao", async () => {
      vi.stubEnv("OVERAGE_PACK_PRICE", "450");
      fakeSupabase.setResolver(router({ clinic }));
      await buyOveragePack();
      expect(fakeSupabase.last("billing_events", "insert")?.payload).toMatchObject({
        amount: 450,
      });
    });

    it("falha ao atualizar a cota aborta antes da cobranca", async () => {
      fakeSupabase.setResolver(router({ clinic, clinicsUpdateError: { message: "quota off" } }));
      await expect(buyOveragePack()).rejects.toThrow("Falha ao atualizar a cota: quota off");
      expect(fakeSupabase.find("billing_events", "insert")).toHaveLength(0);
    });

    it("falha ao registar a cobranca propaga o erro", async () => {
      fakeSupabase.setResolver(router({ clinic, billingError: { message: "lojou off" } }));
      await expect(buyOveragePack()).rejects.toThrow("Falha ao registar a cobrança: lojou off");
      expect(send).not.toHaveBeenCalled();
    });

    it("sem WhatsApp na clinica conclui sem recibo", async () => {
      fakeSupabase.setResolver(router({ clinic: { ...clinic, whatsapp: "" } }));
      const result = await buyOveragePack();
      expect(result.billingEvent).toMatchObject({ id: 42 });
      expect(send).not.toHaveBeenCalled();
    });
  });
});
