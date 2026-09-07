"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";

interface AdminData {
  id: number;
  username: string;
  role: string;
  email: string;
}

export default function PerfilPage() {
  const [admin, setAdmin] = useState<AdminData | null>(null);

  // Email form
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.authenticated && data.admin) {
      setAdmin(data.admin);
      setEmail(data.admin.email ?? "");
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    setEmailMsg(null);
    const res = await fetch("/api/auth/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, currentPassword: emailPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setEmailMsg({ type: "ok", text: "E-mail alterado com sucesso!" });
      setEmailPassword("");
      setAdmin((prev) => (prev ? { ...prev, email: data.email } : prev));
    } else {
      setEmailMsg({ type: "err", text: data.error ?? "Erro ao alterar e-mail." });
    }
    setEmailLoading(false);
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPwLoading(true);
    setPwMsg(null);
    const res = await fetch("/api/auth/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: currentPw,
        newPassword: newPw,
        confirmPassword: confirmPw,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setPwMsg({ type: "ok", text: "Senha alterada com sucesso!" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } else {
      setPwMsg({ type: "err", text: data.error ?? "Erro ao alterar senha." });
    }
    setPwLoading(false);
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Perfil</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie suas credenciais de acesso.
        </p>
      </div>

      {admin && (
        <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <p className="text-sm text-slate-500">Usuário</p>
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>{admin.username}</p>
          <p className="text-sm text-slate-500 mt-2">Função</p>
          <p className="font-medium capitalize" style={{ color: "var(--text-primary)" }}>
            {admin.role.replace("_", " ")}
          </p>
        </div>
      )}

      {/* Alterar E-mail */}
      <form
        onSubmit={handleEmailSubmit}
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Alterar E-mail</h2>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Novo E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="novo@email.com"
            className="w-full rounded-lg px-3 py-2 text-sm bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5] focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Senha Atual (confirmação)
          </label>
          <input
            type="password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5] focus:outline-none"
            required
          />
        </div>

        {emailMsg && (
          <p
            className={`text-sm ${
              emailMsg.type === "ok" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {emailMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={emailLoading}
          className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
        >
          {emailLoading ? "Salvando..." : "Salvar E-mail"}
        </button>
      </form>

      {/* Alterar Senha */}
      <form
        onSubmit={handlePasswordSubmit}
        className="rounded-2xl p-5 space-y-4"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Alterar Senha</h2>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Senha Atual
          </label>
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5] focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Nova Senha
          </label>
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            minLength={8}
            className="w-full rounded-lg px-3 py-2 text-sm bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5] focus:outline-none"
            required
          />
          <p className="text-xs text-slate-400 mt-1">Mínimo de 8 caracteres.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Confirmar Nova Senha
          </label>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            minLength={8}
            className="w-full rounded-lg px-3 py-2 text-sm bg-[rgba(255,255,255,0.04)] text-white border-[rgba(99,102,241,0.1)] focus:border-[#4f6df5] focus:ring-1 focus:ring-[#4f6df5] focus:outline-none"
            required
          />
        </div>

        {pwMsg && (
          <p
            className={`text-sm ${
              pwMsg.type === "ok" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {pwMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={pwLoading}
          className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 text-sm disabled:opacity-50 transition-colors"
        >
          {pwLoading ? "Salvando..." : "Alterar Senha"}
        </button>
      </form>
    </div>
  );
}
