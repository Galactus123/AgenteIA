import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  assignGlobalInstanceToClinicIfEmpty,
  checkKomunikaNumber,
  connectKomunikaInstance,
  connectKomunikaInstanceForClinic,
  getClinicIdByInstanceId,
  getKomunikaInstanceIdForClinic,
  isKomunikaConfigured,
  isKomunikaWebhookSecretConfigured,
  resolveKomunikaInstanceId,
  sendKomunikaMessage,
  sendKomunikaTyping,
  verifyKomunikaSignature,
} from "@/lib/services/komunika";
import { fakeSupabase } from "./helpers/supabase-fake";

vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

// ── Ativação da instância WhatsApp (usada pelo webhook da Lojou) ───────────

const fetchMock = vi.fn();

const originalToken = process.env.KOMUNIKA_API_TOKEN;
const originalInstance = process.env.KOMUNIKA_INSTANCE_ID;

describe("connectKomunikaInstance", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fakeSupabase.reset();
    process.env.KOMUNIKA_API_TOKEN = "token-teste";
    process.env.KOMUNIKA_INSTANCE_ID = "inst-1";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fakeSupabase.reset();
    if (originalToken === undefined) delete process.env.KOMUNIKA_API_TOKEN;
    else process.env.KOMUNIKA_API_TOKEN = originalToken;
    if (originalInstance === undefined) delete process.env.KOMUNIKA_INSTANCE_ID;
    else process.env.KOMUNIKA_INSTANCE_ID = originalInstance;
  });

  it("faz POST /instances/{id}/connect com Bearer token e devolve ok", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => '{"success":true}',
    });

    const result = await connectKomunikaInstance("inst-1", { clinicId: 3 });

    expect(result).toEqual({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/instances/inst-1/connect");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-teste"
    );
    expect(JSON.parse(String(init.body))).toEqual({ instanceId: "inst-1" });
  });

  it("usa a instancia do ambiente por omissao", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "{}",
    });

    await connectKomunikaInstance();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/instances/inst-1/connect");
  });

  it("HTTP != 2xx devolve ok:false com o status e regista o erro", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => '{"message":"instancia offline"}',
    });

    const result = await connectKomunikaInstance("inst-1", { clinicId: 7 });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("instancia offline");
    expect(console.error).toHaveBeenCalled();
    const logged = vi
      .mocked(console.error)
      .mock.calls.flat()
      .join(" ");
    expect(logged).toContain("clinic=7");
  });

  it("falha de rede/timeout devolve ok:false sem lancar excecao", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch timeout"));

    const result = await connectKomunikaInstance("inst-1");

    expect(result).toEqual({ ok: false, error: "fetch timeout" });
    expect(console.error).toHaveBeenCalled();
  });

  it("sem token configurado devolve ok:false sem chamar a API", async () => {
    delete process.env.KOMUNIKA_API_TOKEN;

    const result = await connectKomunikaInstance("inst-1");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("KOMUNIKA_API_TOKEN");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isKomunikaConfigured()).toBe(false);
  });

  it("sem instanceId devolve ok:false sem chamar a API", async () => {
    const result = await connectKomunikaInstance("");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("KOMUNIKA_INSTANCE_ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── Instância WhatsApp por clínica (clinics.komunika_instance_id) ──────────

describe("instância Komunika por clínica", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fakeSupabase.reset();
    process.env.KOMUNIKA_API_TOKEN = "token-teste";
    process.env.KOMUNIKA_INSTANCE_ID = "inst-global";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function withClinicSelect(result: { data?: unknown; error?: { message: string } | null }) {
    fakeSupabase.setResolver((q) =>
      q.table === "clinics" && q.op === "select" ? result : { data: null, error: null }
    );
  }

  function fetchOk() {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => '{"success":true}',
    });
  }

  it("prefere o komunika_instance_id registado na clínica", async () => {
    withClinicSelect({ data: { komunika_instance_id: "inst-luanda" } });

    expect(await getKomunikaInstanceIdForClinic(7)).toEqual({
      instanceId: "inst-luanda",
      source: "clinica",
    });
  });

  it("clínica sem id próprio cai para a variável de ambiente global", async () => {
    withClinicSelect({ data: { komunika_instance_id: "   " } });

    expect(await getKomunikaInstanceIdForClinic(7)).toEqual({
      instanceId: "inst-global",
      source: "ambiente",
    });
  });

  it("erro ao ler a clínica cai para o ambiente e é registado", async () => {
    withClinicSelect({ data: null, error: { message: "coluna off" } });

    expect(await getKomunikaInstanceIdForClinic(7)).toEqual({
      instanceId: "inst-global",
      source: "ambiente",
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("connectKomunikaInstanceForClinic usa a instância da clínica no POST", async () => {
    withClinicSelect({ data: { komunika_instance_id: "inst-beira" } });
    fetchOk();

    const result = await connectKomunikaInstanceForClinic(7);

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      instanceId: "inst-beira",
      source: "clinica",
    });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/instances/inst-beira/connect");
  });

  it("connectKomunikaInstanceForClinic usa a global quando a clínica está vazia", async () => {
    withClinicSelect({ data: { komunika_instance_id: "" } });
    fetchOk();

    const result = await connectKomunikaInstanceForClinic(7);

    expect(result).toMatchObject({
      ok: true,
      instanceId: "inst-global",
      source: "ambiente",
    });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/instances/inst-global/connect");
  });

  it("falha de rede continua a devolver resultado sem lançar", async () => {
    withClinicSelect({ data: { komunika_instance_id: "inst-natal" } });
    fetchMock.mockRejectedValueOnce(new Error("socket fechado"));

    const result = await connectKomunikaInstanceForClinic(7);

    expect(result).toMatchObject({
      ok: false,
      error: "socket fechado",
      instanceId: "inst-natal",
      source: "clinica",
    });
  });
});

// ── Atribuição da instância global quando a clínica está vazia ─────────────

describe("assignGlobalInstanceToClinicIfEmpty", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    process.env.KOMUNIKA_INSTANCE_ID = "inst-global";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fakeSupabase.reset();
    if (originalInstance === undefined) delete process.env.KOMUNIKA_INSTANCE_ID;
    else process.env.KOMUNIKA_INSTANCE_ID = originalInstance;
  });

  it("coluna vazia → grava a global e devolve o id", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "clinics" && q.op === "select") {
        return { data: { komunika_instance_id: "" } };
      }
      if (q.table === "clinics" && q.op === "update") return { data: {} };
      return { data: null };
    });

    await expect(assignGlobalInstanceToClinicIfEmpty(7)).resolves.toBe("inst-global");

    const update = fakeSupabase.last("clinics", "update");
    expect(update?.payload).toEqual({ komunika_instance_id: "inst-global" });
    expect(update?.filters).toContain("id=7");
    expect(update?.filters).toContain("komunika_instance_id=");
  });

  it("coluna já preenchida → devolve o id existente sem escrever", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "clinics" && q.op === "select") {
        return { data: { komunika_instance_id: "inst-beira" } };
      }
      return { data: null };
    });

    await expect(assignGlobalInstanceToClinicIfEmpty(7)).resolves.toBe("inst-beira");
    expect(fakeSupabase.find("clinics", "update")).toHaveLength(0);
  });

  it("sem KOMUNIKA_INSTANCE_ID configurado devolve null sem escrever", async () => {
    delete process.env.KOMUNIKA_INSTANCE_ID;

    await expect(assignGlobalInstanceToClinicIfEmpty(7)).resolves.toBeNull();
    expect(fakeSupabase.find("clinics", "update")).toHaveLength(0);
  });

  it("erro ao ler devolve null e é registado", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "clinics" && q.op === "select") {
        return { data: null, error: { message: "coluna off" } };
      }
      return { data: null };
    });

    await expect(assignGlobalInstanceToClinicIfEmpty(7)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
    expect(fakeSupabase.find("clinics", "update")).toHaveLength(0);
  });

  it("erro ao escrever devolve null e é registado", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "clinics" && q.op === "select") {
        return { data: { komunika_instance_id: "" } };
      }
      if (q.table === "clinics" && q.op === "update") {
        return { data: null, error: { message: "42501" } };
      }
      return { data: null };
    });

    await expect(assignGlobalInstanceToClinicIfEmpty(7)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

// ── Envio por instância (instanceId explícito) ─────────────────────────────

describe("resolveKomunikaInstanceId", () => {
  const saved = process.env.KOMUNIKA_INSTANCE_ID;

  afterEach(() => {
    if (saved === undefined) delete process.env.KOMUNIKA_INSTANCE_ID;
    else process.env.KOMUNIKA_INSTANCE_ID = saved;
  });

  it("prefere a explícita, depois a global, depois string vazia", () => {
    process.env.KOMUNIKA_INSTANCE_ID = "inst-global";

    expect(resolveKomunikaInstanceId("inst-clinica-9")).toBe("inst-clinica-9");
    expect(resolveKomunikaInstanceId(null)).toBe("inst-global");
    expect(resolveKomunikaInstanceId("   ")).toBe("inst-global");

    delete process.env.KOMUNIKA_INSTANCE_ID;
    expect(resolveKomunikaInstanceId()).toBe("");
  });
});

describe("envio por instância (instanceId explícito)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fakeSupabase.reset();
    process.env.KOMUNIKA_API_TOKEN = "token-teste";
    process.env.KOMUNIKA_INSTANCE_ID = "inst-global";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fakeSupabase.reset();
    if (originalToken === undefined) delete process.env.KOMUNIKA_API_TOKEN;
    else process.env.KOMUNIKA_API_TOKEN = originalToken;
    if (originalInstance === undefined) delete process.env.KOMUNIKA_INSTANCE_ID;
    else process.env.KOMUNIKA_INSTANCE_ID = originalInstance;
  });

  function fetchOk(payload: Record<string, unknown> = { success: true }) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });
  }

  function bodyOf(call = 0): Record<string, unknown> {
    const [, init] = fetchMock.mock.calls[call] as [string, RequestInit];
    return JSON.parse(String(init.body));
  }

  it("sendKomunikaMessage usa a instância explícita e ignora a global", async () => {
    fetchOk();

    const result = await sendKomunikaMessage("841234567", "oi", {
      type: "text",
      instanceId: "inst-clinica-9",
    });

    expect(result.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/messages/send");
    expect(bodyOf()).toMatchObject({ instanceId: "inst-clinica-9", to: "841234567" });
  });

  it("sendKomunikaMessage sem instância explícita cai para a global", async () => {
    fetchOk();

    await sendKomunikaMessage("841234567", "oi", { type: "text" });

    expect(bodyOf().instanceId).toBe("inst-global");
  });

  it("checkKomunikaNumber envia a instância explícita no pedido", async () => {
    fetchOk({ success: true, data: [{ exists: true, number: "841234567" }] });

    const result = await checkKomunikaNumber("841234567", "inst-clinica-9");

    expect(result).toEqual({ ok: true, exists: true });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/messages/check-number");
    expect(bodyOf()).toMatchObject({ instanceId: "inst-clinica-9", phone: "841234567" });
  });

  it("sendKomunikaTyping envia a instância explícita no pedido", async () => {
    fetchOk();

    await sendKomunikaTyping("841234567", {
      type: "composing",
      instanceId: "inst-clinica-9",
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain("/messages/typing");
    expect(bodyOf()).toMatchObject({
      instanceId: "inst-clinica-9",
      to: "841234567",
      type: "composing",
    });
  });
});

// ── Lookup inverso: instanceId de entrada → clínica dona ───────────────────

describe("getClinicIdByInstanceId", () => {
  const savedInstance = process.env.KOMUNIKA_INSTANCE_ID;

  beforeEach(() => {
    fakeSupabase.reset();
    process.env.KOMUNIKA_INSTANCE_ID = "inst-global";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fakeSupabase.reset();
    if (savedInstance === undefined) delete process.env.KOMUNIKA_INSTANCE_ID;
    else process.env.KOMUNIKA_INSTANCE_ID = savedInstance;
  });

  it("sem instanceId ou igual à global devolve null sem consultar", async () => {
    await expect(getClinicIdByInstanceId(undefined)).resolves.toBeNull();
    await expect(getClinicIdByInstanceId("")).resolves.toBeNull();
    await expect(getClinicIdByInstanceId("   ")).resolves.toBeNull();
    await expect(getClinicIdByInstanceId("inst-global")).resolves.toBeNull();
    expect(fakeSupabase.find("clinics")).toHaveLength(0);
  });

  it("resolve a clínica dona da instância", async () => {
    fakeSupabase.setResolver((q) =>
      q.table === "clinics" ? { data: { id: 7 } } : undefined
    );

    await expect(getClinicIdByInstanceId("inst-clinica-9")).resolves.toBe(7);

    const sel = fakeSupabase.last("clinics", "select");
    expect(sel?.filters).toContain("komunika_instance_id=inst-clinica-9");
  });

  it("id vindo como string é convertido para number", async () => {
    fakeSupabase.setResolver((q) =>
      q.table === "clinics" ? { data: { id: "42" } } : undefined
    );

    await expect(getClinicIdByInstanceId("inst-x")).resolves.toBe(42);
  });

  it("instância desconhecida devolve null", async () => {
    fakeSupabase.setResolver((q) =>
      q.table === "clinics" ? { data: null, error: null } : undefined
    );

    await expect(getClinicIdByInstanceId("inst-x")).resolves.toBeNull();
  });

  it("erro de banco devolve null e é registado", async () => {
    fakeSupabase.setResolver((q) =>
      q.table === "clinics" ? { data: null, error: { message: "coluna off" } } : undefined
    );

    await expect(getClinicIdByInstanceId("inst-x")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

// ── Assinatura do webhook de entrada (fail-closed) ─────────────────────────

describe("verifyKomunikaSignature", () => {
  const SECRET = "whsec-komunika-teste";
  const BODY = JSON.stringify({ event: "message.received", data: { text: "oi" } });
  const originalSecret = process.env.KOMUNIKA_WEBHOOK_SECRET;

  function hmac(body = BODY, secret = SECRET): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.KOMUNIKA_WEBHOOK_SECRET;
    else process.env.KOMUNIKA_WEBHOOK_SECRET = originalSecret;
  });

  it("sem KOMUNIKA_WEBHOOK_SECRET rejeita até com assinatura válida (fail-closed)", () => {
    delete process.env.KOMUNIKA_WEBHOOK_SECRET;

    expect(isKomunikaWebhookSecretConfigured()).toBe(false);
    expect(verifyKomunikaSignature(BODY, hmac())).toBe(false);
  });

  it("secret vazio também é fail-closed", () => {
    process.env.KOMUNIKA_WEBHOOK_SECRET = "";

    expect(isKomunikaWebhookSecretConfigured()).toBe(false);
    expect(verifyKomunikaSignature(BODY, hmac())).toBe(false);
  });

  it("com secret configurado aceita assinatura HMAC válida", () => {
    process.env.KOMUNIKA_WEBHOOK_SECRET = SECRET;

    expect(isKomunikaWebhookSecretConfigured()).toBe(true);
    expect(verifyKomunikaSignature(BODY, hmac())).toBe(true);
  });

  it("rejeita assinatura gerada com outro secret", () => {
    process.env.KOMUNIKA_WEBHOOK_SECRET = SECRET;

    expect(verifyKomunikaSignature(BODY, hmac(BODY, "outro"))).toBe(false);
  });

  it("rejeita body adulterado após a assinatura", () => {
    process.env.KOMUNIKA_WEBHOOK_SECRET = SECRET;

    expect(verifyKomunikaSignature('{"event":"message.sent"}', hmac())).toBe(false);
  });

  it("rejeita assinatura ausente (null/undefined)", () => {
    process.env.KOMUNIKA_WEBHOOK_SECRET = SECRET;

    expect(verifyKomunikaSignature(BODY, null)).toBe(false);
    expect(verifyKomunikaSignature(BODY, undefined)).toBe(false);
  });
});
