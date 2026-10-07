import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Sidebar from "@/components/sidebar";
import AuthGuard from "@/components/auth-guard";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import SubscriptionGuard from "@/components/subscription-guard";
import { resolveClinicIdByUserId } from "@/lib/api-auth";
import { guardActiveSubscription } from "@/lib/services/plan-limits";
import { BILLING_PATH, canBrowseWithoutSubscription } from "@/lib/subscription-access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let userId: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
    userId = user.id;
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    redirect("/login");
  }

  if (!userId) redirect("/login");

  // ── Gate de subscrição ativa ───────────────────────────────────────────
  // Sem linha ativa em subscriptions (nunca pagou, pendente ou cancelado),
  // só a página de faturação fica acessível: as restantes redirecionam
  // para lá. Conta sem vínculo em clinic_members também cai aqui (sem
  // clinic_id não há assinatura que justifique acesso). Um erro LANÇADO na
  // consulta não tranca a app (falha aberta neste gate) — o gate das rotas
  // de API continua a valer e falha fechado.
  let subscriptionActive = true;
  try {
    const clinicId = await resolveClinicIdByUserId(userId);
    // Sem vínculo em clinic_members não há que verificar: não se deixa o
    // gate correr sem clinic_id (a consulta sem filtro pegaria a assinatura
    // de outra clínica). Quem não tem clínica fica como "sem assinatura".
    subscriptionActive =
      clinicId !== null && (await guardActiveSubscription(clinicId)) === null;
  } catch (error) {
    console.error(
      "[app-layout] Falha ao verificar a assinatura:",
      error instanceof Error ? error.message : String(error)
    );
  }

  if (!subscriptionActive) {
    // x-pathname é enviado pelo proxy. Sem caminho conhecido não se
    // redireciona (evita loop com a própria página de faturação) — nesse
    // caso quem decide é o SubscriptionGuard, com usePathname().
    const pathname = (await headers()).get("x-pathname");
    if (pathname && !canBrowseWithoutSubscription(pathname)) {
      redirect(BILLING_PATH);
    }
  }

  return (
    <AuthGuard>
      <SubscriptionGuard initialActive={subscriptionActive}>
        <div className="flex min-h-screen bg-background overflow-x-hidden">
          <a
            href="#conteudo-principal"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
          >
            Pular para o conteúdo principal
          </a>
          <Sidebar />
          <DashboardShell>{children}</DashboardShell>
        </div>
      </SubscriptionGuard>
    </AuthGuard>
  );
}
