// Papéis de clinic_members (CHECK da migration 20260911000003) traduzidos
// para o painel. Módulo puro (sem Supabase/servidor): usado pelo seletor
// de clínica do header e pela página Minhas Clínicas.
export const CLINIC_ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gestor",
  receptionist: "Recepcionista",
  professional: "Profissional",
  finance: "Financeiro",
  member: "Membro",
};

export function clinicRoleLabel(role: string): string {
  return CLINIC_ROLE_LABELS[role] ?? role;
}
