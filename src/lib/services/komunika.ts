import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

const baseUrl = () => (process.env.KOMUNIKA_BASE_URL ?? "https://api.komunika.site/api/v1").replace(/\/+$/, "");
const apiToken = () => process.env.KOMUNIKA_API_TOKEN ?? "";

export function isKomunikaConfigured(): boolean {
  const token = apiToken();
  const instanceId = process.env.KOMUNIKA_INSTANCE_ID ?? "";
  return Boolean(token && instanceId);
}

// Remove formatações Markdown e caracteres especiais que podem quebrar o JSON enviado à Komunika
export function cleanResponseText(text: string): string {
  return text
    // Remove bold/italic Markdown
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove headers Markdown
    .replace(/^#{1,6}\s+/gm, "")
    // Remove links Markdown, mantendo o texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove listas Markdown
    .replace(/^[\s]*[-*+]\s+/gm, "")
    // Remove listas numeradas
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove blockquotes
    .replace(/^>\s+/gm, "")
    // Remove separadores
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Remove quebras de linha excessivas (máx 2)
    .replace(/\n{3,}/g, "\n\n")
    // Remove caracteres de controle perigosos (exceto \n e \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim();
}

export interface KomunikaSendResult {
  ok: boolean;
  status?: number;
  messageId?: string;
  error?: string;
  rawBody?: unknown;
}

export interface KomunikaNumberCheckResult {
  ok: boolean;
  exists?: boolean;
  status?: number;
  error?: string;
}

// Verifica se o número existe no WhatsApp antes de enviar. A API da Komunika
// devolve 500 quando tenta enviar para um número inexistente, então essa
// verificação prévia evita o erro e mensagens desperdiçadas.
export async function checkKomunikaNumber(phone: string): Promise<KomunikaNumberCheckResult> {
  if (!isKomunikaConfigured()) {
    return { ok: false, error: "Komunika não configurado." };
  }
  try {
    const res = await fetch(`${baseUrl()}/messages/check-number`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken()}`,
      },
      body: JSON.stringify({
        instanceId: process.env.KOMUNIKA_INSTANCE_ID,
        phone,
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: Array<{ exists?: boolean; number?: string }>;
      message?: string;
      error?: string;
    } | null;
    if (!res.ok || !body?.success) {
      console.error(
        `[komunika] Erro ao verificar número: status=${res.status} body=${JSON.stringify(body)}`
      );
      return { ok: false, status: res.status, error: body?.message ?? body?.error ?? res.statusText };
    }
    const exists = body.data?.[0]?.exists ?? false;
    if (!exists) {
      console.log(`[komunika] Numero nao existe no WhatsApp — envio ignorado.`);
    }
    return { ok: true, exists };
  } catch (err) {
    console.error(`[komunika] Exceção ao verificar número:`, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface KomunikaTypingResult {
  ok: boolean;
  status?: number;
  error?: string;
}

// Envia o indicador "digitando..." (typing) para o WhatsApp antes de processar a IA.
export async function sendKomunikaTyping(
  to: string,
  opts: { type?: string } = {}
): Promise<KomunikaTypingResult> {
  if (!isKomunikaConfigured()) {
    return { ok: false, error: "Komunika não configurado." };
  }
  try {
    const res = await fetch(`${baseUrl()}/messages/typing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken()}`,
      },
      body: JSON.stringify({
        instanceId: process.env.KOMUNIKA_INSTANCE_ID,
        to,
        type: opts.type ?? "composing",
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      message?: string;
      error?: string;
    } | null;
    if (!res.ok) {
      console.error(
        `[komunika] Erro ao enviar typing: status=${res.status} body=${JSON.stringify(body)}`
      );
      return { ok: false, status: res.status, error: body?.message ?? body?.error ?? res.statusText };
    }
    console.log(`[komunika] Typing enviado com sucesso: status=${res.status}`);
    return { ok: true, status: res.status };
  } catch (err) {
    console.error(`[komunika] Exceção ao enviar typing:`, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendKomunikaMessage(
  to: string,
  content: string,
  opts: { type?: string } = {}
): Promise<KomunikaSendResult> {
  if (!isKomunikaConfigured()) {
    return { ok: false, error: "Komunika não configurado." };
  }
  // Normaliza o destinatário: apenas dígitos, com código do país (ex.: 258...).
  const normalizedTo = to.replace(/\D/g, "");
  console.log(`[komunika] Normalizando numero: ${to.replace(/\D/g, "").length} digitos`);

  const token = apiToken();
  console.log(`[komunika] Token configurado: ${token ? "sim" : "nao"}`);

  try {
    const bodyPayload = {
      instanceId: process.env.KOMUNIKA_INSTANCE_ID,
      to: normalizedTo,
      phone: normalizedTo,
      type: opts.type ?? "text",
      text: content,
      message: content,
      content,
    };
    console.log("[komunika] Enviando mensagem: tipo=", bodyPayload.type, "tamanho=", content.length);

    const res = await fetch(`${baseUrl()}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    const rawText = await res.text();
    let parsed: { messageId?: string; message?: string; error?: string; statusCode?: number } | null = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // resposta nao-JSON
    }
    console.log("[komunika] Resposta:", res.status, res.ok ? "ok" : "erro");
    if (!res.ok) {
      console.error("[komunika] Erro:", res.status);
      return { ok: false, status: res.status, error: parsed?.message ?? parsed?.error ?? (rawText || res.statusText), rawBody: parsed };
    }
    console.log(`[komunika] Mensagem enviada com sucesso: status=${res.status} messageId=${parsed?.messageId}`);
    return { ok: true, status: res.status, messageId: parsed?.messageId, rawBody: parsed };
  } catch (err) {
    console.error(`[komunika] Exceção ao enviar mensagem:`, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface KomunikaConnectResult {
  ok: boolean;
  status?: number;
  error?: string;
}

// Ativa (conecta) a instancia WhatsApp de uma clinica apos a confirmacao do
// pagamento. Best-effort: NUNCA lanca excecao e tem timeout proprio — quem
// chama (webhook Lojou) apenas regista o resultado, para que uma falha de
// comunicacao com a Komunika nao quebre a resposta do webhook.
export async function connectKomunikaInstance(
  instanceId: string = process.env.KOMUNIKA_INSTANCE_ID ?? "",
  opts: { clinicId?: number } = {}
): Promise<KomunikaConnectResult> {
  const scope = opts.clinicId !== undefined ? `clinic=${opts.clinicId} ` : "";
  if (!apiToken()) {
    return { ok: false, error: "Komunika nao configurado (KOMUNIKA_API_TOKEN)." };
  }
  if (!instanceId) {
    return { ok: false, error: "Komunika nao configurado (KOMUNIKA_INSTANCE_ID)." };
  }
  try {
    const res = await fetch(`${baseUrl()}/instances/${encodeURIComponent(instanceId)}/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken()}`,
      },
      body: JSON.stringify({ instanceId }),
      signal: AbortSignal.timeout(10_000),
    });
    const rawText = await res.text();
    const parsed = (() => {
      try {
        return JSON.parse(rawText) as { message?: string; error?: string } | null;
      } catch {
        return null;
      }
    })();
    if (!res.ok) {
      console.error(
        `[komunika] Falha ao ativar a instancia ${scope}: status=${res.status} body=${rawText.slice(0, 500)}`
      );
      return {
        ok: false,
        status: res.status,
        error: parsed?.message ?? parsed?.error ?? (rawText || res.statusText),
      };
    }
    console.log(`[komunika] Instancia ativada com sucesso: ${scope}status=${res.status}`);
    return { ok: true, status: res.status };
  } catch (err) {
    console.error(`[komunika] Excecao ao ativar a instancia ${scope}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface KomunikaInstanceRef {
  instanceId: string;
  // "clinica" = clinics.komunika_instance_id preenchido;
  // "ambiente" = vazio/ausente, usado KOMUNIKA_INSTANCE_ID global.
  source: "clinica" | "ambiente";
}

// Resolve a instancia WhatsApp de uma clinica (migracao
// 20261006000002_komunika_instance_por_clinica): clinics.komunika_instance_id
// tem prioridade e, quando vazio ou se a leitura falhar, cai para a instancia
// global KOMUNIKA_INSTANCE_ID. Nunca lanca excecao.
export async function getKomunikaInstanceIdForClinic(
  clinicId: number
): Promise<KomunikaInstanceRef> {
  try {
    const { data, error } = await supabaseAdmin
      .from("clinics")
      .select("komunika_instance_id")
      .eq("id", clinicId)
      .maybeSingle();
    if (error) {
      console.error(
        "[komunika] Falha ao ler komunika_instance_id da clinica:",
        error.message
      );
    } else {
      const clinicInstanceId = String(
        (data as { komunika_instance_id?: string | null } | null)
          ?.komunika_instance_id ?? ""
      ).trim();
      if (clinicInstanceId) {
        return { instanceId: clinicInstanceId, source: "clinica" };
      }
    }
  } catch (err) {
    console.error(
      "[komunika] Erro ao resolver a instancia da clinica:",
      err instanceof Error ? err.message : String(err)
    );
  }
  return { instanceId: process.env.KOMUNIKA_INSTANCE_ID ?? "", source: "ambiente" };
}

export interface KomunikaClinicConnectResult extends KomunikaConnectResult {
  instanceId: string;
  source: "clinica" | "ambiente";
}

// Ativa a instancia WhatsApp da clinica usando o ID registado na linha dela
// (fallback: variavel global). Best-effort: qualquer erro fica nos logs e o
// resultado devolvido e apenas para diagnostico do chamador.
export async function connectKomunikaInstanceForClinic(
  clinicId: number
): Promise<KomunikaClinicConnectResult> {
  const { instanceId, source } = await getKomunikaInstanceIdForClinic(clinicId);
  const result = await connectKomunikaInstance(instanceId, { clinicId });
  return { ...result, instanceId, source };
}

export function verifyKomunikaSignature(rawBody: Buffer | string, signature?: string | null): boolean {
  const secret = process.env.KOMUNIKA_WEBHOOK_SECRET ?? "";
  if (!secret) return true;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface KomunikaInboundMessage {
  phone: string;
  text: string;
  instanceId?: string;
}

// Aceita os formatos de payload mais comuns (`data.text` / `data.message.content`,
// ou um body plano com `phone`/`from` + `text`/`content`).
// Retorna null se a mensagem foi enviada pelo próprio bot (fromMe) para evitar loops.
export function parseKomunikaInbound(body: Record<string, unknown>): KomunikaInboundMessage | null {
  const data = (body.data ?? body) as Record<string, unknown>;

  // Ignora mensagens enviadas pelo próprio bot — evita loop infinito.
  // Aceita tanto camelCase (fromMe) quanto snake_case (from_me), e também true como string.
  const fromMe = data.fromMe ?? data.from_me ?? body.fromMe ?? body.from_me;
  if (fromMe === true || fromMe === "true" || fromMe === "1" || fromMe === 1) {
    return null;
  }

  const text = String(
    data.text ??
      extractMessageText(data.message ?? data.payload ?? data) ??
      body.text ??
      body.content ??
      ""
  ).trim();

   // Prioriza o remetente (from / sender) — NÃO o destinatário (to) da instância.
   const phone = String(
     data.from ??
       (data.sender as { phone?: string } | undefined)?.phone ??
       (data.contact as { phone?: string } | undefined)?.phone ??
       data.phone ??
       ""
   ).replace(/\D/g, "");

  if (!phone || !text) return null;
  return { phone, text, instanceId: String(data.instanceId ?? process.env.KOMUNIKA_INSTANCE_ID ?? "") };
}

function extractMessageText(msg: unknown): string {
  if (typeof msg === "string") return msg;
  if (msg && typeof msg === "object") {
    const m = msg as Record<string, unknown>;
    if (typeof m.text === "string") return m.text;
    if (typeof m.content === "string") return m.content;
    if (typeof m.body === "string") return m.body;
  }
  return "";
}