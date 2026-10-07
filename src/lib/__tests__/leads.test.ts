import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase } from "./helpers/supabase-fake";

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

import { parseTrialLead, saveTrialLead, type TrialLead } from "@/lib/services/leads";

// ── Leads do funil público: validação server-side + gravação ────────────────
//
// Regra de ouro testada aqui: campos obrigatórios (clínica, nome, WhatsApp)
// rejeitam a sério; a atribuição opcional (país, plano, fonte, utm) é
// saneada e nunca invalida um lead válido.

const validInput = {
  clinicName: "  Clínica Central  ",
  contactName: "  Ana Silva  ",
  whatsapp: "+258 84 123 4567",
  country: "mz",
  specialty: "Pediatria",
  email: "Ana@Exemplo.com",
  plan: "pro",
  source: "teste-gratis",
  utmSource: "precos",
};

describe("parseTrialLead — validação", () => {
  it("aceita um lead válido e saneia espaços, e-mail e WhatsApp", () => {
    const result = parseTrialLead(validInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      clinic_name: "Clínica Central",
      contact_name: "Ana Silva",
      whatsapp: "258841234567",
      country: "mz",
      specialty: "Pediatria",
      email: "ana@exemplo.com",
      plan: "pro",
      source: "teste-gratis",
      utm_source: "precos",
    });
  });

  it("rejeita payload que não é objeto", () => {
    for (const bad of [null, undefined, "texto", 42, ["a"], true]) {
      const result = parseTrialLead(bad);
      expect(result.ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("rejeita campos obrigatórios em falta ou vazios", () => {
    const base = { ...validInput };

    expect(parseTrialLead({ ...base, clinicName: "" }).ok).toBe(false);
    expect(parseTrialLead({ ...base, clinicName: "A" }).ok).toBe(false);
    expect(parseTrialLead({ ...base, contactName: "   " }).ok).toBe(false);
    expect(parseTrialLead({ ...base, whatsapp: "" }).ok).toBe(false);
    // Não-string: vira "" e cai na mesma validação.
    expect(parseTrialLead({ ...base, clinicName: 123 }).ok).toBe(false);
    expect(parseTrialLead({ ...base, whatsapp: { digits: 1 } }).ok).toBe(false);
  });

  it("rejeita WhatsApp fora do intervalo de 7 a 15 dígitos", () => {
    const base = { ...validInput };

    expect(parseTrialLead({ ...base, whatsapp: "123456" }).ok).toBe(false); // 6
    expect(parseTrialLead({ ...base, whatsapp: "abcdefghi" }).ok).toBe(false); // sem dígitos
    expect(
      parseTrialLead({ ...base, whatsapp: "1234567890123456" }).ok // 16
    ).toBe(false);
    expect(parseTrialLead({ ...base, whatsapp: "84 123 456" }).ok).toBe(true); // 9
  });

  it("rejeita e-mail malformado mas aceita o formulário sem e-mail", () => {
    const base = { ...validInput };

    expect(parseTrialLead({ ...base, email: "ana@exemplo" }).ok).toBe(false);
    expect(parseTrialLead({ ...base, email: "sem-arroba.com" }).ok).toBe(false);
    expect(parseTrialLead({ ...base, email: `${"a".repeat(201)}@x.com` }).ok).toBe(false);

    const withoutEmail = parseTrialLead({ ...base, email: undefined });
    expect(withoutEmail.ok).toBe(true);
    if (withoutEmail.ok) expect(withoutEmail.value.email).toBeNull();
  });

  it("atribuição inválida é ignorada em vez de perder o lead", () => {
    const result = parseTrialLead({
      ...validInput,
      country: "pt",
      plan: "gratuito",
      source: "SRC COM ESPAÇOS!",
      utmSource: "utm value com espaços",
      specialty: 999,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.country).toBe("br");
    expect(result.value.plan).toBeNull();
    expect(result.value.source).toBe("teste-gratis");
    expect(result.value.utm_source).toBeNull();
    expect(result.value.specialty).toBeNull();
  });

  it("mantém os planos conhecidos e não estoura os limites de tamanho", () => {
    for (const plan of ["start", "pro", "business", "enterprise"]) {
      const result = parseTrialLead({ ...validInput, plan });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.plan).toBe(plan);
    }

    const long = parseTrialLead({
      ...validInput,
      clinicName: "x".repeat(500),
      contactName: "y".repeat(500),
    });
    expect(long.ok).toBe(true);
    if (long.ok) {
      expect(long.value.clinic_name).toHaveLength(120);
      expect(long.value.contact_name).toHaveLength(120);
    }
  });
});

describe("saveTrialLead — gravação", () => {
  beforeEach(() => fakeSupabase.reset());

  const lead: TrialLead = {
    clinic_name: "Clínica Central",
    contact_name: "Ana Silva",
    whatsapp: "258841234567",
    country: "mz",
    specialty: "Pediatria",
    email: "ana@example.com",
    plan: "pro",
    source: "teste-gratis",
    utm_source: "precos",
  };

  it("grava o lead e devolve ok", async () => {
    fakeSupabase.setResolver(() => ({ data: null, error: null }));

    await expect(saveTrialLead(lead)).resolves.toEqual({ ok: true });
    expect(fakeSupabase.last("trial_leads", "insert")?.payload).toEqual(lead);
  });

  it("23505 (e-mail já registado) conta como sucesso duplicado", async () => {
    fakeSupabase.setResolver(() => ({ data: null, error: { message: "duplicate key", code: "23505" } }));

    await expect(saveTrialLead(lead)).resolves.toEqual({ ok: true, duplicate: true });
  });

  it("erro de banco devolve ok:false e regista a causa em log", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fakeSupabase.setResolver(() => ({
      data: null,
      error: { message: "permission denied for table trial_leads" },
    }));

    await expect(saveTrialLead(lead)).resolves.toEqual({ ok: false });
    expect(consoleError).toHaveBeenCalled();
    expect(String(consoleError.mock.calls[0]?.[1])).toContain("permission denied");
    consoleError.mockRestore();
  });
});
