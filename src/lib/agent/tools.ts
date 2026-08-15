import type { LlmToolDefinition } from "@/lib/agent/llm";
import { listSpecialties, getSpecialty } from "@/lib/services/specialties";
import { getAvailableSlots, createAppointment, findUpcomingAppointmentByPhone, rescheduleAppointment, cancelAppointment } from "@/lib/services/appointments";

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
        "Busca os horários livres disponíveis para uma especialidade em uma data. Retorna slots com médico, data, hora e preço. Data no formato YYYY-MM-DD.",
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
        "Agenda uma consulta após o paciente escolher o horário. Só chamar quando o paciente confirmou médico, data e hora.",
      parameters: {
        type: "object",
        properties: {
          patient_name: { type: "string" },
          patient_phone: { type: "string" },
          specialty_id: { type: "number" },
          doctor_id: { type: "number" },
          starts_at: { type: "string", description: "Data e hora no formato YYYY-MM-DD HH:MM" },
          reason: { type: "string", description: "Motivo relatado pelo paciente" },
        },
        required: ["patient_name", "patient_phone", "specialty_id", "doctor_id", "starts_at"],
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
        "Remarca uma consulta existente para um novo horário. Só chamar após o paciente confirmar o novo horário.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "number" },
          new_starts_at: { type: "string", description: "Nova data e hora no formato YYYY-MM-DD HH:MM" },
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
        "Cancela uma consulta existente. Só chamar após o paciente confirmar explicitamente o cancelamento.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "number" },
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
}

export interface ToolContext {
  conversationId: number | null;
}

function slotExists(specialtyId: number, doctorId: number, startsAt: string): boolean {
  const date = startsAt.split(" ")[0];
  return getAvailableSlots(specialtyId, date).some(
    (s) => s.doctor_id === doctorId && s.starts_at === startsAt
  );
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
        specialties = listSpecialties();
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
      const specialty = getSpecialty(specialtyId);
      if (!specialty) return { output: "Especialidade não encontrada." };
      const slots = getAvailableSlots(specialtyId, date);
      if (slots.length === 0) {
        return {
          output: `Nenhum horário livre em ${date} para ${specialty.name}. O paciente deve escolher outra data.`,
        };
      }
      return {
        output: JSON.stringify(
          slots.map((s) => ({
            doctor_id: s.doctor_id,
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
      const doctorId = Number(args.doctor_id);
      const startsAt = String(args.starts_at);
      if (!slotExists(specialtyId, doctorId, startsAt)) {
        return { output: "Erro: este horário não está mais disponível. Apresente outros horários." };
      }
      const appointment = createAppointment({
        patient_name: String(args.patient_name),
        patient_phone: String(args.patient_phone),
        specialty_id: specialtyId,
        doctor_id: doctorId,
        starts_at: startsAt,
        reason: args.reason ? String(args.reason) : "",
        source: "ia",
        conversation_id: ctx.conversationId,
      });
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
      const appointment = findUpcomingAppointmentByPhone(phone);
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
      try {
        const appointment = rescheduleAppointment(
          Number(args.appointment_id),
          String(args.new_starts_at)
        );
        return {
          output: JSON.stringify({
            ok: true,
            appointment_id: appointment.id,
            doctor: appointment.doctor_name,
            date_time: appointment.starts_at,
          }),
        };
      } catch (error) {
        return {
          output: `Erro ao remarcar: ${error instanceof Error ? error.message : "erro desconhecido"}`,
        };
      }
    }

    case "cancel_appointment": {
      try {
        cancelAppointment(Number(args.appointment_id));
        return { output: JSON.stringify({ ok: true, appointment_id: Number(args.appointment_id) }) };
      } catch (error) {
        return {
          output: `Erro ao cancelar: ${error instanceof Error ? error.message : "erro desconhecido"}`,
        };
      }
    }

    case "transfer_to_human": {
      return {
        output: "Transferência solicitada. A recepção assumirá este atendimento.",
        transferToHuman: true,
      };
    }

    default:
      return { output: `Tool desconhecida: ${name}` };
  }
}
