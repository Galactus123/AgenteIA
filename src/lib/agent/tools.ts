import type { LlmToolDefinition } from "@/lib/agent/llm";
import { listSpecialties, getSpecialty } from "@/lib/services/specialties";
import {
  getAvailableSlots,
  createAppointment,
  findUpcomingAppointmentByPhone,
  rescheduleAppointment,
  cancelAppointment,
  getAppointment,
  canCancel,
  canReschedule,
  SlotTakenError,
  OutsideHoursError,
} from "@/lib/services/appointments";
import type { AppointmentView, AvailableSlot } from "@/lib/types";

export const toolDefinitions: LlmToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_specialties",
      description:
        "Lista as especialidades médicas disponíveis na clínica, com id, nome e descrição. Use para indicar a especialidade adequada ao problema do paciente.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_availability",
      description:
        "Busca os horários livres disponíveis para uma especialidade em uma data. Retorna slots com profissional, data, hora e preço. Data no formato YYYY-MM-DD.",
      parameters: {
        type: "object",
        properties: {
          specialty_id: { type: "number", description: "Id da especialidade" },
          date: { type: "string", description: "Data no formato YYYY-MM-DD" },
        },
        required: ["specialty_id", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Agenda uma consulta após o paciente escolher o horário. Só chamar quando o paciente confirmou profissional, data e hora.",
      parameters: {
        type: "object",
        properties: {
          patient_name: { type: "string" },
          patient_phone: { type: "string" },
          specialty_id: { type: "number" },
          professional_id: { type: "string", description: "Identificador do profissional retornado por get_availability" },
          starts_at: { type: "string", description: "Data e hora no formato YYYY-MM-DD HH:MM" },
          reason: { type: "string", description: "Motivo relatado pelo paciente" },
        },
        required: ["patient_name", "patient_phone", "specialty_id", "professional_id", "starts_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_appointment",
      description:
        "Busca a consulta futura agendada para um número de WhatsApp do paciente. Use antes de remarcar ou cancelar.",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Número de WhatsApp do paciente" },
        },
        required: ["phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description:
        "Remarca uma consulta existente. Duas etapas: 1) chame SEM confirm para validar as regras; 2) depois de o paciente confirmar explicitamente o novo horário, chame de novo com confirm=true.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "number" },
          new_starts_at: { type: "string", description: "Nova data e hora no formato YYYY-MM-DD HH:MM" },
          confirm: {
            type: "boolean",
            description:
              "true SOMENTE após o paciente confirmar explicitamente a remarcação. Sem isso a tool não executa.",
          },
        },
        required: ["appointment_id", "new_starts_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description:
        "Cancela uma consulta existente. Duas etapas: 1) chame SEM confirm para validar as regras; 2) depois de o paciente confirmar explicitamente o cancelamento, chame de novo com confirm=true.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "number" },
          confirm: {
            type: "boolean",
            description:
              "true SOMENTE após o paciente confirmar explicitamente o cancelamento. Sem isso a tool não executa.",
          },
        },
        required: ["appointment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description:
        "Transfere o atendimento para a recepção humana quando o agente não consegue resolver, o paciente pede atendente, ou há urgência/emergência.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Motivo da transferência" },
        },
        required: ["reason"],
      },
    },
  },
];

export interface ToolResult {
  output: string;
  transferToHuman?: boolean;
  transferReason?: string;
}

export interface ToolContext {
  conversationId: number | null;
  // Clínica da conversa (quando resolvida — Ponto 3/4 no inbound): limita
  // catálogo, agenda e escritas à clínica do próprio atendimento.
  clinicId?: number;
}

async function slotExists(
  specialtyId: number,
  professionalId: string,
  startsAt: string,
  clinicId?: number
): Promise<boolean> {
  const date = startsAt.split(" ")[0];
  const slots = await getAvailableSlots(specialtyId, date, clinicId);
  return slots.some((s) => s.professional_id === professionalId && s.starts_at === startsAt);
}

// Resposta de "horario indisponivel" (corrida de slot ou fora do
// expediente — Fases 3.3/3.6) com alternativas reais para o LLM.
async function slotUnavailableResult(
  specialtyId: number,
  professionalId: string,
  startsAt: string,
  message: string,
  hint: string,
  clinicId?: number
): Promise<ToolResult> {
  let alternatives: AvailableSlot[] = [];
  try {
    const date = startsAt.split(" ")[0];
    const slots = await getAvailableSlots(specialtyId, date, clinicId);
    const sameProfessional = slots.filter((s) => s.professional_id === professionalId);
    alternatives = (sameProfessional.length ? sameProfessional : slots).slice(0, 3);
  } catch {
    alternatives = [];
  }
  return {
    output: JSON.stringify({
      ok: false,
      error: message,
      alternatives: alternatives.map((s) => ({
        professional_id: s.professional_id,
        doctor_name: s.doctor_name,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        price: s.price,
      })),
      hint,
    }),
  };
}

// Fase 3.7 — etapa 1 das duas etapas: regras validadas, falta a
// confirmacao explicita do paciente. A tool NAO executa sem confirm=true.
function confirmationPending(
  action: "cancelamento" | "remarcação",
  summary: Record<string, unknown>
): ToolResult {
  return {
    output: JSON.stringify({
      ok: false,
      needs_confirmation: true,
      summary,
      message: `Regras validadas para ${action}. Pergunte ao paciente de forma explícita ("Confirma o ${action} da consulta de ${summary.date_time ?? ""}?", sim/não) e só após a resposta positiva chame esta tool novamente com confirm=true.`,
    }),
  };
}

// Fase 3.6 — janela de 4h / limite de remarcações: só a recepção
// humana pode concluir a operação, o agente deve transferir.
function humanOnly(reason: string): ToolResult {
  return {
    output: JSON.stringify({
      ok: false,
      requires_human: true,
      reason,
      hint: "Regra de negócio da clínica: esta operação só pode ser feita pela recepção. Explique com empatia e chame transfer_to_human.",
    }),
  };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  console.log(`[tools:${new Date().toISOString()}] executando "${name}"`, args);
  try {
    const result = await dispatchTool(name, args, ctx);
    console.log(`[tools:${new Date().toISOString()}] "${name}" ok → ${result.output.slice(0, 150)}`);
    return result;
  } catch (err) {
    console.error(`[tools:${new Date().toISOString()}] erro na tool "${name}":`, err);
    return {
      output: `Erro ao executar "${name}": ${err instanceof Error ? err.message : String(err)}. Informe o paciente com empatia e ofereça alternativas.`,
    };
  }
}

async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  switch (name) {
    case "list_specialties": {
      let specialties;
      try {
        specialties = await listSpecialties(ctx.clinicId);
      } catch (err) {
        console.error("[tools:list_specialties] falha ao consultar especialidades no banco:", err);
        return {
          output:
            "Não foi possível carregar as especialidades agora. Peça desculpas ao paciente e ofereça transferir para um atendente humano.",
        };
      }
      if (specialties.length === 0) {
        return {
          output:
            "Nenhuma especialidade cadastrada na clínica no momento. Informe ao paciente que as especialidades ainda não foram configuradas e ofereça transferir para um atendente.",
        };
      }
      return { output: JSON.stringify(specialties) };
    }

    case "get_availability": {
      const specialtyId = Number(args.specialty_id);
      const date = String(args.date);
      const specialty = await getSpecialty(specialtyId, ctx.clinicId);
      if (!specialty) return { output: "Especialidade não encontrada." };
      const slots = await getAvailableSlots(specialtyId, date, ctx.clinicId);
      if (slots.length === 0) {
        return {
          output: `Nenhum horário livre em ${date} para ${specialty.name}. O paciente deve escolher outra data.`,
        };
      }
      return {
        output: JSON.stringify(
          slots.map((s) => ({
            professional_id: s.professional_id,
            doctor_name: s.doctor_name,
            starts_at: s.starts_at,
            ends_at: s.ends_at,
            price: s.price,
          }))
        ),
      };
    }

    case "book_appointment": {
      const specialtyId = Number(args.specialty_id);
      const professionalId = String(args.professional_id);
      const startsAt = String(args.starts_at);
      if (!(await slotExists(specialtyId, professionalId, startsAt, ctx.clinicId))) {
        return { output: "Erro: este horário não está mais disponível. Apresente outros horários." };
      }
      let appointment: AppointmentView;
      try {
        appointment = await createAppointment({
          patient_name: String(args.patient_name),
          patient_phone: String(args.patient_phone),
          specialty_id: specialtyId,
          professional_id: professionalId,
          starts_at: startsAt,
          reason: args.reason ? String(args.reason) : "",
          source: "ia",
          conversation_id: ctx.conversationId,
          clinicId: ctx.clinicId,
        });
      } catch (error) {
        if (error instanceof SlotTakenError) {
          // Outra conversa ocupou o horario entre a checagem e o insert.
          return slotUnavailableResult(
            specialtyId,
            professionalId,
            startsAt,
            error.message,
            "Informe o paciente que o horario acabou de ser ocupado e apresente as alternativas.",
            ctx.clinicId
          );
        }
        if (error instanceof OutsideHoursError) {
          // Fase 3.6: fora do expediente ou horario no passado.
          return slotUnavailableResult(
            specialtyId,
            professionalId,
            startsAt,
            error.message,
            "Apresente um dos horários livres retornados, que já respeitam o expediente do profissional.",
            ctx.clinicId
          );
        }
        throw error;
      }
      return {
        output: JSON.stringify({
          ok: true,
          appointment_id: appointment.id,
          patient: appointment.patient_name,
          doctor: appointment.doctor_name,
          specialty: appointment.specialty_name,
          date_time: appointment.starts_at,
          clinic: appointment.clinic_name,
          address: appointment.clinic_address,
          price: appointment.price,
        }),
      };
    }

    case "find_appointment": {
      const phone = String(args.phone);
      const appointment = await findUpcomingAppointmentByPhone(phone, ctx.clinicId);
      if (!appointment) {
        return { output: "Nenhuma consulta futura encontrada para este número." };
      }
      return {
        output: JSON.stringify({
          appointment_id: appointment.id,
          patient: appointment.patient_name,
          doctor: appointment.doctor_name,
          specialty: appointment.specialty_name,
          date_time: appointment.starts_at,
          clinic: appointment.clinic_name,
        }),
      };
    }

    case "reschedule_appointment": {
      const appointmentId = Number(args.appointment_id);
      const newStartsAt = String(args.new_starts_at);

      const current = await getAppointment(appointmentId, ctx.clinicId);
      if (!current) {
        return { output: JSON.stringify({ ok: false, error: "Consulta não encontrada." }) };
      }

      // Etapa 0 — regras de negocio (Fase 3.6): dentro da janela de 4h
      // ou ja remarcada 1x, so a recepcao humana resolve.
      const rule = canReschedule(current);
      if (!rule.ok) {
        return rule.requiresHuman
          ? humanOnly(rule.reason ?? "")
          : { output: JSON.stringify({ ok: false, error: rule.reason }) };
      }

      // Etapa 1 — confirmacao explicita em duas etapas (Fase 3.7).
      if (args.confirm !== true) {
        return confirmationPending("remarcação", {
          appointment_id: current.id,
          patient: current.patient_name,
          date_time: current.starts_at,
          new_starts_at: newStartsAt,
        });
      }

      // Etapa 2 — executa.
      try {
        const appointment = await rescheduleAppointment(appointmentId, newStartsAt, ctx.clinicId);
        return {
          output: JSON.stringify({
            ok: true,
            appointment_id: appointment.id,
            doctor: appointment.doctor_name,
            date_time: appointment.starts_at,
          }),
        };
      } catch (error) {
        if (error instanceof SlotTakenError) {
          return {
            output: JSON.stringify({
              ok: false,
              error: error.message,
              hint: "Chame get_availability para oferecer outros horarios ao paciente.",
            }),
          };
        }
        if (error instanceof OutsideHoursError) {
          return {
            output: JSON.stringify({
              ok: false,
              error: error.message,
              hint: "Chame get_availability e apresente um horário dentro do expediente do profissional.",
            }),
          };
        }
        return {
          output: `Erro ao remarcar: ${error instanceof Error ? error.message : "erro desconhecido"}`,
        };
      }
    }

    case "cancel_appointment": {
      const appointmentId = Number(args.appointment_id);

      const current = await getAppointment(appointmentId, ctx.clinicId);
      if (!current) {
        return { output: JSON.stringify({ ok: false, error: "Consulta não encontrada." }) };
      }

      // Etapa 0 — regra das 4h (Fase 3.6): fora da janela, so humano.
      const rule = canCancel(current);
      if (!rule.ok) {
        return rule.requiresHuman
          ? humanOnly(rule.reason ?? "")
          : { output: JSON.stringify({ ok: false, error: rule.reason }) };
      }

      // Etapa 1 — confirmacao explicita em duas etapas (Fase 3.7).
      if (args.confirm !== true) {
        return confirmationPending("cancelamento", {
          appointment_id: current.id,
          patient: current.patient_name,
          date_time: current.starts_at,
        });
      }

      // Etapa 2 — executa.
      try {
        await cancelAppointment(appointmentId, ctx.clinicId);
        return { output: JSON.stringify({ ok: true, appointment_id: appointmentId }) };
      } catch (error) {
        return {
          output: `Erro ao cancelar: ${error instanceof Error ? error.message : "erro desconhecido"}`,
        };
      }
    }

    case "transfer_to_human": {
      return {
        output:
          "Transferência solicitada. A recepção assumirá este atendimento; não execute mais nenhuma ação.",
        transferToHuman: true,
        transferReason: args.reason ? String(args.reason) : "",
      };
    }

    default:
      return { output: `Tool desconhecida: ${name}` };
  }
}
