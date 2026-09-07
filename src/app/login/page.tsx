"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

type Panel = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<Panel>("signin");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Sign In state ──────────────────────────────────────────────────
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Sign Up state ──────────────────────────────────────────────────
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [signupPassConfirm, setSignupPassConfirm] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginUser, password: loginPass }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      router.replace("/dashboard");
      router.refresh();
    } else {
      setLoginError(data?.error ?? "Erro ao entrar.");
      setLoginLoading(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setSignupError("");

    if (signupPass !== signupPassConfirm) {
      setSignupError("As senhas não coincidem.");
      return;
    }
    if (signupPass.length < 8) {
      setSignupError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setSignupLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: signupName,
        email: signupEmail,
        password: signupPass,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setSignupSuccess(true);
      setSignupLoading(false);
    } else {
      setSignupError(data?.error ?? "Erro ao cadastrar.");
      setSignupLoading(false);
    }
  }

  const isSignup = activePanel === "signup";

  /* ═══════════════════════════════════════════════════════════════════
     MOBILE LAYOUT (< 768px)
     ═══════════════════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <div
        className={`relative flex flex-col overflow-hidden bg-gradient-to-br from-[#0B0D14] via-[#0D1020] to-[#0F1328] ${inter.variable}`}
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          minHeight: "100dvh",
          padding: "1.5rem",
        }}
      >
        {/* ── Background geometric shapes ────────────────────────────── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-highlight/5 blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 h-72 w-72 rounded-full bg-primary-light/40 blur-2xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "radial-gradient(circle, #4f6df5 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
        </div>

        {/* ── Mobile content ─────────────────────────────────────────── */}
        <div className="relative z-10 flex flex-1 flex-col">
          {/* ── Logo ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary text-white text-lg font-bold">
              S
            </div>
            <span className="text-xl font-semibold text-white">SaudeSync</span>
          </div>

          {/* ── Tab switcher ─────────────────────────────────────────── */}
          <div
            className="flex rounded-2xl bg-[#161926]/80 backdrop-blur-md border border-[rgba(99,102,241,0.15)] shadow-sm p-1 mb-6"
            role="tablist"
          >
            <button
              role="tab"
              aria-selected={!isSignup}
              onClick={() => setActivePanel("signin")}
              className="flex-1 rounded-xl py-3 text-sm font-medium transition-all duration-300"
              style={{
                background: !isSignup ? "var(--color-primary)" : "transparent",
                color: !isSignup ? "#fff" : "#64748b",
                boxShadow: !isSignup ? "0 4px 12px rgba(79,109,245,0.3)" : "none",
              }}
            >
              Entrar
            </button>
            <button
              role="tab"
              aria-selected={isSignup}
              onClick={() => setActivePanel("signup")}
              className="flex-1 rounded-xl py-3 text-sm font-medium transition-all duration-300"
              style={{
                background: isSignup ? "var(--color-primary)" : "transparent",
                color: isSignup ? "#fff" : "#64748b",
                boxShadow: isSignup ? "0 4px 12px rgba(79,109,245,0.3)" : "none",
              }}
            >
              Criar Conta
            </button>
          </div>

          {/* ── Forms (scrollable area) ──────────────────────────────── */}
          <div
            className="flex-1 rounded-3xl bg-[#161926]/80 backdrop-blur-xl shadow-2xl shadow-black/30 border border-[rgba(99,102,241,0.15)] p-6"
            style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}
          >
            {/* ── Sign In ──────────────────────────────────────────── */}
            {!isSignup && (
              <div
                style={{
                  opacity: isSignup ? 0 : 1,
                  transition: "opacity 0.3s ease",
                }}
              >
                <h2 className="text-xl font-semibold text-white mb-1">Bem-vindo de volta</h2>
                <p className="text-sm text-slate-400 mb-6">Entre na sua conta para continuar.</p>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                      placeholder="Usuário ou e-mail"
                      className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                      style={{ fontWeight: 400, fontSize: "16px", height: "48px" }}
                      required
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      placeholder="Senha"
                      className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                      style={{ fontWeight: 400, fontSize: "16px", height: "48px" }}
                      required
                    />
                  </div>

                  {loginError && (
                    <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{loginError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full rounded-xl bg-primary hover:bg-primary-dark text-white font-medium text-sm disabled:opacity-50 transition-all duration-200 shadow-lg shadow-primary/25"
                    style={{ height: "48px" }}
                  >
                    {loginLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Entrando...
                      </span>
                    ) : "Entrar"}
                  </button>
                </form>
              </div>
            )}

            {/* ── Sign Up ──────────────────────────────────────────── */}
            {isSignup && !signupSuccess && (
              <div
                style={{
                  opacity: isSignup ? 1 : 0,
                  transition: "opacity 0.3s ease",
                }}
              >
                <h2 className="text-xl font-semibold text-white mb-1">Criar conta</h2>
                <p className="text-sm text-slate-400 mb-6">Preencha os dados para começar.</p>

                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                      style={{ fontWeight: 400, fontSize: "16px", height: "48px" }}
                      required
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="E-mail"
                      className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                      style={{ fontWeight: 400, fontSize: "16px", height: "48px" }}
                      required
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={signupPass}
                      onChange={(e) => setSignupPass(e.target.value)}
                      placeholder="Senha (mín. 8 caracteres)"
                      className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                      style={{ fontWeight: 400, fontSize: "16px", height: "48px" }}
                      required
                      minLength={8}
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={signupPassConfirm}
                      onChange={(e) => setSignupPassConfirm(e.target.value)}
                      placeholder="Confirmar senha"
                      className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                      style={{ fontWeight: 400, fontSize: "16px", height: "48px" }}
                      required
                      minLength={8}
                    />
                  </div>

                  {signupError && (
                    <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{signupError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={signupLoading}
                    className="w-full rounded-xl bg-primary hover:bg-primary-dark text-white font-medium text-sm disabled:opacity-50 transition-all duration-200 shadow-lg shadow-primary/25"
                    style={{ height: "48px" }}
                  >
                    {signupLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Cadastrando...
                      </span>
                    ) : "Cadastrar"}
                  </button>
                </form>
              </div>
            )}

            {/* ── Signup success ──────────────────────────────────── */}
            {isSignup && signupSuccess && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-400 mb-4">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white">Conta criada!</h3>
                <p className="text-sm text-slate-400 mt-2 mb-6">Agora faça login para acessar o painel.</p>
                <button
                  onClick={() => {
                    setSignupSuccess(false);
                    setActivePanel("signin");
                    setSignupName("");
                    setSignupEmail("");
                    setSignupPass("");
                    setSignupPassConfirm("");
                  }}
                  className="rounded-xl border-2 border-[#4f6df5] text-primary hover:bg-primary hover:text-white font-medium px-8 py-3 text-sm transition-all duration-200"
                >
                  Ir para o Login
                </button>
              </div>
            )}
          </div>

          {/* ── Footer links ────────────────────────────────────────── */}
          <p className="text-xs text-slate-500 text-center mt-4">
            <a href="/landing" className="hover:text-primary transition-colors">Voltar para o site</a>
            <span className="mx-2">·</span>
            <a href="/termos" className="hover:text-primary transition-colors">Termos</a>
            <span className="mx-2">·</span>
            <a href="/privacidade" className="hover:text-primary transition-colors">Privacidade</a>
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     DESKTOP LAYOUT (>= 768px) — Sliding overlay
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div
      className={`relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0B0D14] via-[#0D1020] to-[#0F1328] ${inter.variable}`}
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      {/* ── Background geometric shapes ────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-highlight/5 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 h-72 w-72 rounded-full bg-primary-light/40 blur-2xl" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle, #4f6df5 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
        <div className="absolute top-20 right-[15%] h-16 w-16 rounded-2xl border border-[#4f6df5]/10 rotate-12 animate-[spin_40s_linear_infinite]" />
        <div className="absolute bottom-32 left-[10%] h-12 w-12 rounded-full border border-highlight/15 animate-[spin_30s_linear_infinite_reverse]" />
        <div className="absolute top-1/2 left-[20%] h-8 w-8 rounded-lg border border-[#4f6df5]/10 rotate-45 animate-[pulse_4s_ease-in-out_infinite]" />
      </div>

      {/* ── Main card ──────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl mx-4">
        <div
          className="relative flex min-h-[540px] rounded-3xl bg-[#161926]/80 backdrop-blur-xl shadow-2xl shadow-black/30 border border-[rgba(99,102,241,0.15)]"
          style={{ overflow: "hidden" }}
        >
          {/* ── Left half: Sign In form ──────────────────────────────── */}
          <div
            className="relative w-1/2 flex flex-col justify-center px-10 py-12"
            style={{
              opacity: isSignup ? 0 : 1,
              visibility: isSignup ? "hidden" : "visible",
              transition: "opacity 0.5s cubic-bezier(0.65,0,0.35,1), visibility 0.5s",
            }}
          >
            <div
              style={{
                transform: isSignup ? "translateX(12px)" : "translateX(0)",
                transition: "transform 0.6s cubic-bezier(0.65,0,0.35,1)",
              }}
            >
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-white text-lg font-bold">
                    S
                  </div>
                  <span className="text-lg font-semibold text-white">SaudeSync</span>
                </div>
                <h2 className="text-2xl font-semibold text-white">Bem-vindo de volta</h2>
                <p className="text-sm text-slate-400 mt-1">Entre na sua conta para continuar.</p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder="Usuário ou e-mail"
                    className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                    style={{ fontWeight: 400 }}
                    required
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="Senha"
                    className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                    style={{ fontWeight: 400 }}
                    required
                  />
                </div>

                {loginError && (
                  <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{loginError}</p>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full rounded-xl bg-primary hover:bg-primary-dark text-white font-medium py-3 text-sm disabled:opacity-50 transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
                >
                  {loginLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Entrando...
                    </span>
                  ) : "Entrar"}
                </button>
              </form>
            </div>
          </div>

          {/* ── Right half: Sign Up form ─────────────────────────────── */}
          <div
            className="relative w-1/2 flex flex-col justify-center px-10 py-12"
            style={{
              opacity: isSignup ? 1 : 0,
              visibility: isSignup ? "visible" : "hidden",
              transition: "opacity 0.5s cubic-bezier(0.65,0,0.35,1), visibility 0.5s",
            }}
          >
            <div
              style={{
                transform: isSignup ? "translateX(0)" : "translateX(-12px)",
                transition: "transform 0.6s cubic-bezier(0.65,0,0.35,1)",
              }}
            >
              {!signupSuccess && (
                <>
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-white text-lg font-bold">
                        S
                      </div>
                      <span className="text-lg font-semibold text-white">SaudeSync</span>
                    </div>
                    <h2 className="text-2xl font-semibold text-white">Criar conta</h2>
                    <p className="text-sm text-slate-400 mt-1">Preencha os dados para começar.</p>
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-3">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        placeholder="Nome completo"
                        className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                        style={{ fontWeight: 400 }}
                        required
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="E-mail"
                        className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                        style={{ fontWeight: 400 }}
                        required
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <input
                        type="password"
                        value={signupPass}
                        onChange={(e) => setSignupPass(e.target.value)}
                        placeholder="Senha (mín. 8 caracteres)"
                        className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                        style={{ fontWeight: 400 }}
                        required
                        minLength={8}
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                      <input
                        type="password"
                        value={signupPassConfirm}
                        onChange={(e) => setSignupPassConfirm(e.target.value)}
                        placeholder="Confirmar senha"
                        className="w-full rounded-xl border border-[rgba(99,102,241,0.15)] bg-[rgba(255,255,255,0.04)] pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 placeholder:font-normal focus:border-[#4f6df5] focus:ring-2 focus:ring-[#4f6df5]/20 focus:outline-none transition-all"
                        style={{ fontWeight: 400 }}
                        required
                        minLength={8}
                      />
                    </div>

                    {signupError && (
                      <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{signupError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={signupLoading}
                      className="w-full rounded-xl bg-primary hover:bg-primary-dark text-white font-medium py-3 text-sm disabled:opacity-50 transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
                    >
                      {signupLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          Cadastrando...
                        </span>
                      ) : "Cadastrar"}
                    </button>
                  </form>
                </>
              )}

              {signupSuccess && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-400 mb-4">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white">Conta criada!</h3>
                  <p className="text-sm text-slate-400 mt-2 mb-6">Agora faça login para acessar o painel.</p>
                  <button
                    onClick={() => {
                      setSignupSuccess(false);
                      setActivePanel("signin");
                      setSignupName("");
                      setSignupEmail("");
                      setSignupPass("");
                      setSignupPassConfirm("");
                    }}
                    className="rounded-xl border-2 border-[#4f6df5] text-primary hover:bg-primary hover:text-white font-medium px-8 py-3 text-sm transition-all duration-200"
                  >
                    Ir para o Login
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Sliding overlay panel ─────────────────────────────── */}
          <div
            className="absolute top-0 left-1/2 h-full w-1/2 flex flex-col items-center justify-center px-10 z-20"
            style={{
              willChange: "transform",
              transform: isSignup ? "translateX(-100%)" : "translateX(0)",
              transition: "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
              background: "linear-gradient(135deg, #4f6df5 0%, #3b54c4 50%, #2d43a8 100%)",
            }}
          >
            <div className="absolute top-8 right-8 h-20 w-20 rounded-full border-2 border-white/10" />
            <div className="absolute bottom-12 left-8 h-14 w-14 rounded-full border-2 border-white/10" />
            <div className="absolute top-1/3 -left-4 h-8 w-8 rounded-full bg-white/5" />

            <div
              className="text-center text-white"
              style={{
                willChange: "transform",
                transform: isSignup ? "translateX(24px)" : "translateX(0)",
                transition: "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
              }}
            >
              <div
                className="flex items-center justify-center gap-3 mb-6"
                style={{
                  willChange: "transform",
                  transform: isSignup ? "translateX(-8px)" : "translateX(0)",
                  transition: "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
                }}
              >
                <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm text-white text-xl font-bold">
                  S
                </div>
              </div>

              {!isSignup ? (
                <>
                  <h3
                    className="text-2xl font-semibold mb-3"
                    style={{
                      willChange: "transform",
                      transform: isSignup ? "translateX(12px)" : "translateX(0)",
                      transition: "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
                    }}
                  >
                    Novo por aqui?
                  </h3>
                  <p
                    className="text-sm text-white/80 mb-8 max-w-[260px] leading-relaxed"
                    style={{
                      willChange: "transform",
                      transform: isSignup ? "translateX(16px)" : "translateX(0)",
                      transition: "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
                    }}
                  >
                    Crie sua conta e comece a gerenciar agendamentos com inteligência artificial.
                  </p>
                  <button
                    onClick={() => setActivePanel("signup")}
                    className="rounded-xl border-2 border-white/40 text-white hover:bg-white/10 font-medium px-10 py-3 text-sm transition-all duration-200 backdrop-blur-sm"
                  >
                    Criar conta
                  </button>
                </>
              ) : (
                <>
                  <h3
                    className="text-2xl font-semibold mb-3"
                    style={{
                      willChange: "transform",
                      transform: isSignup ? "translateX(-12px)" : "translateX(0)",
                      transition: "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
                    }}
                  >
                    Já tem conta?
                  </h3>
                  <p
                    className="text-sm text-white/80 mb-8 max-w-[260px] leading-relaxed"
                    style={{
                      willChange: "transform",
                      transform: isSignup ? "translateX(-16px)" : "translateX(0)",
                      transition: "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
                    }}
                  >
                    Faça login para acessar seu painel de agendamentos e configurações.
                  </p>
                  <button
                    onClick={() => setActivePanel("signin")}
                    className="rounded-xl border-2 border-white/40 text-white hover:bg-white/10 font-medium px-10 py-3 text-sm transition-all duration-200 backdrop-blur-sm"
                  >
                    Fazer login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer links ────────────────────────────────────────── */}
        <p className="text-xs text-slate-500 text-center mt-6">
          <a href="/landing" className="hover:text-primary transition-colors">Voltar para o site</a>
          <span className="mx-2">·</span>
          <a href="/termos" className="hover:text-primary transition-colors">Termos</a>
          <span className="mx-2">·</span>
          <a href="/privacidade" className="hover:text-primary transition-colors">Privacidade</a>
        </p>
      </div>
    </div>
  );
}
