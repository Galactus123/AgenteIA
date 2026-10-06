import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  connectKomunikaInstance,
  connectKomunikaInstanceForClinic,
  getKomunikaInstanceIdForClinic,
  isKomunikaConfigured,
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
