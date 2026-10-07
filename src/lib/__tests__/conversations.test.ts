import { describe, it, expect, vi, beforeEach } from "vitest";

// Servico de conversas (Fase 8.3): get-or-create com corrida 23505,
// mensagens e atualizacao de status — tudo contra o harness fake.
vi.mock("@/lib/supabase", async () => {
  const { fakeSupabase } = await import("./helpers/supabase-fake");
  return { supabaseAdmin: fakeSupabase.admin };
});

import { fakeSupabase } from "./helpers/supabase-fake";
import { PlanLimitError } from "@/lib/services/plan-limits";
import {
  getOrCreateConversation,
  getConversation,
  getConversationByPhone,
  updateConversation,
  addMessage,
  getMessages,
  listConversations,
} from "@/lib/services/conversations";

const row = { id: 7, phone: "258841234567", patient_name: "Maria", status: "open" };

describe("conversations (Fase 8.3)", () => {
  beforeEach(() => {
    fakeSupabase.reset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("normaliza o telefone (remove nao-digitos) na busca por phone", async () => {
    fakeSupabase.setResolver(() => ({ data: row }));
    const conv = await getOrCreateConversation("+258 84 123 4567");
    expect(conv).toEqual(row);
    expect(fakeSupabase.last("conversations")?.filters).toContain("phone=258841234567");
    expect(fakeSupabase.find("conversations", "insert")).toHaveLength(0);
  });

  it("cria a conversa quando nao existe e envia o payload normalizado", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.op === "select") return { data: null };
      return { data: row };
    });
    const conv = await getOrCreateConversation("84 123 4567");
    expect(conv).toEqual(row);
    const ins = fakeSupabase.last("conversations", "insert");
    expect(ins?.payload).toMatchObject({
      phone: "841234567",
      patient_name: "",
      status: "open",
    });
  });

  it("corrida 23505: relê a conversa criada por outra requisicao", async () => {
    // Primeira leitura ainda sem linha; o insert cai no 23505; a relêitura
    // (nao chamada via getOrCreate, mas pelo caminho de recuperacao) devolve
    // a linha. Aqui simulamos: select → null, insert → 23505, select → row.
    let reads = 0;
    fakeSupabase.setResolver((q) => {
      if (q.op === "select") {
        reads += 1;
        return { data: reads === 1 ? null : row };
      }
      return { error: { message: "duplicate key", code: "23505" } };
    });

    const conv = await getOrCreateConversation("841234567");
    expect(conv).toEqual(row);
    expect(fakeSupabase.find("conversations", "insert")).toHaveLength(1);
  });

  it("erro de leitura derruba com mensagem do servico", async () => {
    fakeSupabase.setResolver(() => ({ error: { message: "pg off" } }));
    await expect(getOrCreateConversation("841")).rejects.toThrow("[conversations] pg off");
  });

  it("insert invalido (sem 23505) tambem derruba", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.op === "select") return { data: null };
      return { error: { message: "not-null", code: "23502" } };
    });
    await expect(getOrCreateConversation("841")).rejects.toThrow("[conversations] not-null");
  });

  it("getConversation / getConversationByPhone devolvem null sem achado", async () => {
    fakeSupabase.setResolver(() => ({ data: null }));
    expect(await getConversation(99)).toBeNull();
    expect(await getConversationByPhone("+258 84 000 0000", 1)).toBeNull();
  });

  it("updateConversation sem linha existente e um no-op (sem update)", async () => {
    fakeSupabase.setResolver(() => ({ data: null }));
    await updateConversation(99, { status: "transferred" });
    expect(fakeSupabase.find("conversations", "update")).toHaveLength(0);
  });

  it("updateConversation preserva os campos atuais quando o patch nao os traz", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.op === "select") return { data: { ...row, patient_name: "Maria" } };
      if (q.op === "update") return { data: null, error: null };
      return {};
    });
    await updateConversation(7, { status: "transferred" });
    const upd = fakeSupabase.last("conversations", "update");
    expect(upd?.payload).toMatchObject({ patient_name: "Maria", status: "transferred" });
  });

  it("updateConversation propaga erro do banco", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.op === "select") return { data: row };
      return { error: { message: "lock timeout" } };
    });
    await expect(updateConversation(7, { status: "open" })).rejects.toThrow(
      "[conversations] lock timeout"
    );
  });

  it("addMessage grava a mensagem e toca o updated_at da conversa", async () => {
    const msg = { id: 1, conversation_id: 7, sender: "bot", content: "oi" };
    fakeSupabase.setResolver((q) => {
      if (q.table === "messages" && q.op === "insert") return { data: msg };
      return { data: null, error: null };
    });
    const out = await addMessage(7, "bot", "oi");
    expect(out).toEqual(msg);
    const ins = fakeSupabase.last("messages", "insert");
    expect(ins?.payload).toMatchObject({ conversation_id: 7, sender: "bot", content: "oi" });
    expect(fakeSupabase.last("conversations", "update")?.payload).toHaveProperty("updated_at");
  });

  it("addMessage com erro na mensagem derruba em [messages]", async () => {
    fakeSupabase.setResolver(() => ({ error: { message: "fk violada" } }));
    await expect(addMessage(7, "bot", "oi")).rejects.toThrow("[messages] fk violada");
  });

  it("addMessage com erro no toque da conversa derruba em [conversations]", async () => {
    fakeSupabase.setResolver((q) => {
      if (q.table === "messages") return { data: { id: 1 } };
      return { error: { message: "conversa sumiu" } };
    });
    await expect(addMessage(7, "bot", "oi")).rejects.toThrow("[conversations] conversa sumiu");
  });

  it("getMessages ordena por created_at e id; lista vazia sem erro", async () => {
    fakeSupabase.setResolver(() => ({ data: [] }));
    expect(await getMessages(7)).toEqual([]);
    const q = fakeSupabase.last("messages");
    expect(q?.filters).toContain("order:created_at");
    expect(q?.filters).toContain("order:id");
  });

  it("getMessages com erro propaga a falha", async () => {
    fakeSupabase.setResolver(() => ({ error: { message: "timeout" } }));
    await expect(getMessages(7)).rejects.toThrow("[messages] timeout");
  });

  it("listConversations ordena por updated_at desc e propaga erro", async () => {
    fakeSupabase.setResolver(() => ({ data: [row] }));
    expect(await listConversations(1)).toEqual([row]);
    expect(fakeSupabase.last("conversations")?.filters).toContain("order:updated_at:desc");

    fakeSupabase.setResolver(() => ({ error: { message: "off" } }));
    await expect(listConversations(1)).rejects.toThrow("[conversations] off");
  });

  describe("limites de plano na criação", () => {
    it("no limite de conversas ativas lança PlanLimitError e não insere", async () => {
      fakeSupabase.setResolver((q) => {
        if (q.table === "conversations" && q.opts.head) return { count: 100, error: null };
        if (q.op === "select") return { data: null };
        return { data: row };
      });

      const err = await getOrCreateConversation("84 999 000 111").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PlanLimitError);
      expect((err as PlanLimitError).planName).toBe("Start");
      expect((err as Error).message).toContain("conversas ativas");
      expect(fakeSupabase.find("conversations", "insert")).toHaveLength(0);
    });

    it("com cota de WhatsApp esgotada também bloqueia a conversa nova", async () => {
      fakeSupabase.setResolver((q) => {
        if (q.table === "usage" && q.op === "select")
          return { data: [{ id: "u1", whatsapp_conversations: 500, ai_interactions: 0 }] };
        if (q.table === "conversations" && q.opts.head) return { count: 1, error: null };
        if (q.op === "select") return { data: null };
        return { data: row };
      });

      const err = await getOrCreateConversation("84 999 000 222").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PlanLimitError);
      expect((err as Error).message).toContain("500 conversas WhatsApp");
      expect(fakeSupabase.find("conversations", "insert")).toHaveLength(0);
    });

    it("conversa existente segue livre mesmo no limite", async () => {
      fakeSupabase.setResolver((q) => {
        if (q.table === "conversations" && q.opts.head) return { count: 100, error: null };
        if (q.op === "select") return { data: row };
        return { data: row };
      });

      expect(await getOrCreateConversation("+258 84 123 4567")).toEqual(row);
      expect(fakeSupabase.find("conversations", "insert")).toHaveLength(0);
    });

    it("criação nova incrementa o contador de conversas WhatsApp do período", async () => {
      fakeSupabase.setResolver((q) => {
        if (q.op === "rpc")
          return {
            data: { id: "u1", clinic_id: 1, period: "2026-10", whatsapp_conversations: 1, ai_interactions: 0 },
            error: null,
          };
        if (q.op === "select") return { data: null };
        if (q.table === "conversations") return { data: row };
        return { data: null, error: null };
      });

      expect(await getOrCreateConversation("84 123 4567")).toEqual(row);

      const rpc = fakeSupabase.queries.find((q) => q.op === "rpc");
      expect(rpc?.table).toBe("increment_usage_counters");
      expect(rpc?.payload).toMatchObject({ p_whatsapp: 1, p_ai: 0 });
      expect(fakeSupabase.find("usage", "insert")).toHaveLength(0);
    });
  });
});
