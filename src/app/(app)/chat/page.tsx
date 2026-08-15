"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: number;
  sender: string;
  content: string;
  created_at: string;
}

const DEFAULT_PHONE = "+258 84 111 2222";
const SAMPLE_PHONES = [
  { label: "Ana", value: "+258 84 111 2222" },
  { label: "Carlos", value: "+258 82 333 4444" },
  { label: "Mariana", value: "+258 86 555 6666" },
];

export default function ChatPage() {
  const [phone, setPhone] = useState(DEFAULT_PHONE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [transferred, setTransferred] = useState(false);
  const [status, setStatus] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Busca histórico usando conversationId quando disponível, senão phone
  const fetchHistory = useCallback(async (targetPhone: string) => {
    // Cancela fetch anterior se ainda estiver em andamento
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setHistoryLoaded(false);
    try {
      const res = await fetch(`/api/chat/history?phone=${encodeURIComponent(targetPhone)}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (!controller.signal.aborted) {
        setMessages(data.messages ?? []);
        setTransferred(false);
        setHistoryLoaded(true);
      }
    } catch {
      if (!controller.signal.aborted) {
        setMessages([]);
        setHistoryLoaded(true);
      }
    }
  }, []);

  // Carrega histórico ao trocar de phone
  useEffect(() => {
    fetchHistory(phone);
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [phone, fetchHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading || !historyLoaded) return;
    setInput("");
    setLoading(true);
    setStatus("digitando...");

    // Adiciona mensagem do paciente optimisticamente
    const patientMsg: ChatMessage = {
      id: Date.now(),
      sender: "patient",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, patientMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: text, phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: "bot",
            content: data.resposta ?? data.reply ?? "",
            created_at: new Date().toISOString(),
          },
        ]);
        setTransferred(Boolean(data.transferred));
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: "system",
            content: data.error ?? "Erro ao enviar mensagem.",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "system",
          content: "Falha de conexão. Tente novamente.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Atendimento IA (simulador WhatsApp)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Simule a conversa de um paciente com a recepcionista virtual. Escolha um número para testar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-slate-700">WhatsApp do paciente:</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex gap-1.5">
          {SAMPLE_PHONES.map((p) => (
            <button
              key={p.value}
              onClick={() => setPhone(p.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                phone === p.value
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-slate-600 border-slate-300 hover:border-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {transferred && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          Esta conversa foi transferida para a recepção humana.
        </div>
      )}

      <div className="bg-[#e5ddd5] rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#075e54] px-5 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center text-sm font-bold">
            {phone.slice(-4)}
          </div>
          <div>
            <p className="text-white font-medium text-sm">SaúdeSync — Recepcionista Virtual</p>
            <p className="text-teal-100 text-xs">
              {status || (loading ? "digitando..." : !historyLoaded ? "carregando conversa..." : "online")}
            </p>
          </div>
        </div>

        <div className="h-[420px] overflow-y-auto p-4 space-y-2 scrollbar-thin">
          {!historyLoaded && (
            <p className="text-center text-sm text-slate-500 py-10">Carregando conversa...</p>
          )}
          {historyLoaded && messages.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-10">
              Envie uma mensagem para iniciar a conversa, por exemplo:
              <br />
              <span className="text-slate-600">&quot;Estou com dor de cabeça há três dias&quot;</span>
            </p>
          )}
          {messages.map((m) => {
            const isPatient = m.sender === "patient";
            const isSystem = m.sender === "system";
            if (isSystem) {
              return (
                <div key={m.id} className="text-center">
                  <span className="inline-block bg-white/70 text-slate-500 text-xs rounded-full px-3 py-1">
                    {m.content}
                  </span>
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${isPatient ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm text-sm ${
                    isPatient
                      ? "bg-[#d9fdd3] text-slate-800 rounded-br-sm"
                      : "bg-white text-slate-800 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className="text-right text-[10px] text-slate-400 mt-1">
                    {m.created_at.slice(11, 16)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 p-3 bg-slate-50 border-t border-slate-200">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={!historyLoaded ? "Carregando..." : "Digite sua mensagem..."}
            disabled={loading || !historyLoaded}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || !historyLoaded}
            className="rounded-full bg-primary hover:bg-primary-dark text-white px-5 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4 text-sm text-slate-600 space-y-1">
        <p className="font-medium text-slate-800">Dicas para testar o fluxo do PRD:</p>
        <p>• Agendar: informe o problema e confirme o horário que a IA sugerir.</p>
        <p>• Remarcar: diga &quot;quero remarcar minha consulta&quot;.</p>
        <p>• Cancelar: diga &quot;quero cancelar minha consulta&quot;.</p>
        <p>• Transferir: diga &quot;quero falar com um atendente&quot;.</p>
      </div>
    </div>
  );
}
