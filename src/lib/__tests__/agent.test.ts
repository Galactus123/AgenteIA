import { describe, it, expect, vi, beforeEach } from "vitest";

// Env dummy: several modules import @/lib/supabase at load time.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-de-teste";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-de-teste";
});

const store = vi.hoisted(() => {
  const state = {
    conversation: {
      id: 1,
      phone: "+258 84 111 2222",
      patient_name: "Maria Silva",
      status: "open",
      created_at: "2026-10-05T10:00:00+00:00",
      updated_at: "2026-10-05T10:00:00+00:00",
    },
    messages: [] as { id: number; conversation_id: number; sender: string; content: string }[],
    reset(status = "open") {
      state.conversation.status = status;
      state.messages = [];
    },
  };
  return state;
});

vi.mock("@/lib/agent/llm", () => ({
  isLlmConfigured: vi.fn(() => true),
  callLlm: vi.fn(),
}));

vi.mock("@/lib/agent/tools", () => ({
  toolDefinitions: [],
  executeTool: vi.fn(),
}));

vi.mock("@/lib/agent/prompts", () => ({
  buildSystemPrompt: vi.fn(async () => "SYSTEM"),
}));

vi.mock("@/lib/services/conversations", () => ({
  getOrCreateConversation: vi.fn(async () => ({ ...store.conversation })),
  getConversation: vi.fn(async (id: number) => (id === store.conversation.id ? { ...store.conversation } : null)),
  updateConversation: vi.fn(async (_id: number, patch: Record<string, unknown>) => {
    Object.assign(store.conversation, patch);
    return { ...store.conversation };
  }),
  addMessage: vi.fn(
    async (conversationId: number, sender: string, content: string) => {
      store.messages.push({
        id: store.messages.length + 1,
        conversation_id: conversationId,
        sender,
        content,
      });
      return store.messages[store.messages.length - 1];
    }
  ),
  getMessages: vi.fn(async () => [...store.messages]),
}));

vi.mock("@/lib/services/subscriptions", () => ({
  hasAiQuota: vi.fn(async () => true),
  consumeTokens: vi.fn(async () => ({ clinic: null, nearLimitAlert: false })),
  blockForQuota: vi.fn(async () => undefined),
}));

vi.mock("@/lib/services/transfers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/transfers")>();
  return { ...actual, notifyReceptionTransfer: vi.fn(async () => undefined) };
});

import { handlePatientMessage } from "@/lib/agent/agent";
import { callLlm, isLlmConfigured } from "@/lib/agent/llm";
import { executeTool } from "@/lib/agent/tools";
import { addMessage, updateConversation } from "@/lib/services/conversations";
import { blockForQuota, consumeTokens, hasAiQuota } from "@/lib/services/subscriptions";
import {
  HUMAN_TRANSFER_NOTICE,
  TRANSFER_WAITING_REPLY,
  notifyReceptionTransfer,
} from "@/lib/services/transfers";

const PHONE = "+258 84 111 2222";

const llmMock = vi.mocked(callLlm);
const toolMock = vi.mocked(executeTool);

function finalReply(content: string) {
  return { content, toolCalls: [], totalTokens: 120 };
}

function toolTurn(name: string, args: Record<string, unknown> = {}) {
  return {
    content: null,
    toolCalls: [{ id: `call_${name}`, type: "function" as const, function: { name, arguments: JSON.stringify(args) } }],
    totalTokens: 55,
  };
}

describe("agente - loop, transferência e quota (Fase 5.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
    vi.mocked(isLlmConfigured).mockReturnValue(true);
    vi.mocked(hasAiQuota).mockResolvedValue(true);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("responde direto no primeiro turno e consome os tokens", async () => {
    llmMock.mockResolvedValueOnce(finalReply("Olá! Posso ajudar."));

    const result = await handlePatientMessage(PHONE, "oi, tudo bem?");

    expect(result.reply).toBe("Olá! Posso ajudar.");
    expect(result.transferred).toBe(false);
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(toolMock).not.toHaveBeenCalled();
    expect(consumeTokens).toHaveBeenCalledWith(120);
    expect(addMessage).toHaveBeenCalledWith(1, "bot", "Olá! Posso ajudar.");
    expect(addMessage).toHaveBeenCalledWith(1, "patient", "oi, tudo bem?");
  });

  it("processa tool call e só responde na iteração seguinte", async () => {
    llmMock
      .mockResolvedValueOnce(toolTurn("get_availability"))
      .mockResolvedValueOnce(finalReply("Temos horário amanhã."));
    toolMock.mockResolvedValueOnce({ output: "09:00", transferToHuman: false });

    const result = await handlePatientMessage(PHONE, "quer agendar");

    expect(result.reply).toBe("Temos horário amanhã.");
    expect(llmMock).toHaveBeenCalledTimes(2);
    expect(toolMock).toHaveBeenCalledTimes(1);
    expect(toolMock).toHaveBeenCalledWith("get_availability", {}, expect.anything());
    expect(consumeTokens).toHaveBeenCalledTimes(2);
    expect(consumeTokens).toHaveBeenCalledWith(55);
  });

  it("para no limite de iterações com fallback consciente (sem loop infinito)", async () => {
    llmMock.mockResolvedValue(toolTurn("get_availability"));
    toolMock.mockResolvedValue({ output: "slots", transferToHuman: false });

    const result = await handlePatientMessage(PHONE, "oi");

    expect(llmMock).toHaveBeenCalledTimes(8);
    expect(result.reply).toContain("me diz seu nome");
    expect(result.transferred).toBe(false);
    expect(addMessage).toHaveBeenCalledWith(1, "bot", result.reply);
  });

  it("transfer_to_human encerra o loop e notifica a recepção", async () => {
    llmMock.mockResolvedValueOnce(toolTurn("transfer_to_human", { reason: "consulta complexa" }));
    toolMock.mockResolvedValueOnce({
      output: "transferindo",
      transferToHuman: true,
      transferReason: "consulta complexa",
    });

    const result = await handlePatientMessage(PHONE, "preciso falar com alguem");

    expect(result.reply).toBe(HUMAN_TRANSFER_NOTICE);
    expect(result.transferred).toBe(true);
    expect(updateConversation).toHaveBeenCalledWith(1, { status: "transferred" });
    expect(notifyReceptionTransfer).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), "consulta complexa");
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(addMessage).toHaveBeenCalledWith(1, "bot", HUMAN_TRANSFER_NOTICE);
  });

  it("cota esgotada: bloqueia antes do LLM e marca WAITING_HUMAN_INTERVENTION", async () => {
    vi.mocked(hasAiQuota).mockResolvedValue(false);

    const result = await handlePatientMessage(PHONE, "oi");

    expect(llmMock).not.toHaveBeenCalled();
    expect(result.transferred).toBe(true);
    expect(result.reply).toContain("transferindo sua conversa para a nossa equipe de recepção");
    expect(updateConversation).toHaveBeenCalledWith(1, { status: "WAITING_HUMAN_INTERVENTION" });
    expect(blockForQuota).toHaveBeenCalledWith(PHONE);
    expect(addMessage).toHaveBeenCalledWith(1, "bot", expect.stringContaining("recepção"));
  });

  it("conversa já transferida: IA fora, sem chamada de LLM", async () => {
    store.reset("transferred");

    const result = await handlePatientMessage(PHONE, "ainda estou com duvidas");

    expect(llmMock).not.toHaveBeenCalled();
    expect(result.reply).toBe(TRANSFER_WAITING_REPLY);
    expect(result.transferred).toBe(false);
    expect(addMessage).toHaveBeenCalledWith(1, "patient", "ainda estou com duvidas");
    expect(addMessage).toHaveBeenCalledWith(1, "bot", TRANSFER_WAITING_REPLY);
  });

  it("cota restaurada retoma o atendimento de WAITING_HUMAN_INTERVENTION", async () => {
    store.reset("WAITING_HUMAN_INTERVENTION");
    vi.mocked(hasAiQuota).mockResolvedValue(true);
    llmMock.mockResolvedValueOnce(finalReply("De volta!"));

    const result = await handlePatientMessage(PHONE, "ola");

    expect(updateConversation).toHaveBeenCalledWith(1, { status: "open" });
    expect(result.reply).toBe("De volta!");
    expect(llmMock).toHaveBeenCalledTimes(1);
  });

  it("LLM indisponível vira mensagem de erro, não exceção", async () => {
    llmMock.mockRejectedValueOnce(new Error("timeout do provedor"));

    const result = await handlePatientMessage(PHONE, "oi");

    expect(result.reply).toContain("problema momentâneo");
    expect(result.transferred).toBe(false);
    expect(addMessage).toHaveBeenCalledWith(1, "bot", expect.stringContaining("atendente da recepção"));
    expect(console.error).toHaveBeenCalled();
  });

  it("sem OPENAI_API_KEY o agente responde o aviso de manutenção", async () => {
    vi.mocked(isLlmConfigured).mockReturnValue(false);

    const result = await handlePatientMessage(PHONE, "oi");

    expect(llmMock).not.toHaveBeenCalled();
    expect(result.reply).toContain("chave de IA não foi configurada");
  });
});
