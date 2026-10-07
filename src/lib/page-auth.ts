import { createClient } from "@/utils/supabase/server";
import { resolveClinicIdByUserId } from "@/lib/api-auth";

// Clínica do utilizador para Server Components (páginas do painel). Mesma
// derivação servidor-a-servidor das rotas de API (clinic_members do próprio
// user) — nunca assume a "primeira clínica" da base de dados. Sem sessão ou
// sem vínculo ativo devolve null: a página trata como falha de leitura e não
// mostra dados de outra clínica.
export async function resolvePageClinicId(): Promise<number | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;
    return await resolveClinicIdByUserId(user.id);
  } catch (err) {
    console.error(
      "[page-auth] Falha ao resolver a clínica da página:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
