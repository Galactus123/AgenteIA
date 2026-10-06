"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BILLING_PATH, canBrowseWithoutSubscription } from "@/lib/subscription-access";

interface StatusPayload {
  active?: boolean;
}

// Bloqueia o acesso às páginas operacionais das clínicas sem subscrição
// ativa (sem linha em subscriptions ou com estado pendente/cancelado).
// A página de faturação fica sempre acessível — é lá que o utilizador paga e
// volta a desbloquear a conta. O gate do servidor (app/layout) cobre o
// primeiro carregamento; aqui cobrem-se as navegações internas, já que o
// layout partilhado não volta a correr no servidor nesses casos.
export default function SubscriptionGuard({
  initialActive,
  children,
}: {
  initialActive: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(initialActive);
  // Último caminho cuja verificação terminou: `checkedPath !== pathname`
  // diz-nos que a verificação corrente ainda está a decorrer (derivado do
  // estado, sem precisar de setState sincróneo dentro do effect).
  const [checkedPath, setCheckedPath] = useState<string | null>(null);

  const allowed = canBrowseWithoutSubscription(pathname);
  const checking = checkedPath !== pathname;

  // Revalida a cada navegação enquanto a conta estiver bloqueada: o valor do
  // servidor fica congelado no primeiro render e o webhook da LOJOU pode ter
  // gravado a assinatura entretanto (pagamento fechado noutra aba). Contas
  // ativas não fazem este fetch — o gate das APIs continua a valer nelas e o
  // estado só muda no próximo carregamento completo.
  // O redirect só acontece no fim da verificação, para não voltar a mandar
  // para a faturação alguém que acabou de pagar.
  useEffect(() => {
    if (active) return;
    let cancelled = false;

    fetch("/api/subscription/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StatusPayload | null) => {
        if (cancelled) return;
        if (typeof data?.active === "boolean") setActive(data.active);
        setCheckedPath(pathname);
      })
      .catch(() => {
        // Falha de rede: mantém o último estado conhecido e desbloqueia o
        // redirect com esse mesmo estado.
        if (!cancelled) setCheckedPath(pathname);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, active]);

  useEffect(() => {
    if (!checking && !active && !allowed) router.replace(BILLING_PATH);
  }, [checking, active, allowed, router]);

  if (!active && !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Assinatura necessária
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {checking
              ? "A verificar a assinatura…"
              : "A redirecionar para a página de faturação…"}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
