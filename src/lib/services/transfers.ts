import { createNotification } from "@/lib/services/notifications";
import { getMessages } from "@/lib/services/conversations";
import type { Conversation } from "@/lib/types";

// Texto enviado ao paciente no momento da transferencia (tambem usado
// pelo webhook como resposta final da IA quando ela se despede).
export const HUMAN_TRANSFER_NOTICE =
  "Se preferir falar com um atendente agora, a recepcionista vai te atender em breve. Obrigado pela paciência!";

// Resposta para o paciente quando a conversa ja esta com os humanos:
// a IA fica fora do atendimento e nao chama o LLM.
export const TRANSFER_WAITING_REPLY =
  "Sua conversa já está com a nossa equipe de recepção. Um atendente vai te responder por aqui em breve! 😊";

const HISTORY_LIMIT = 10;
const SNIPPET_MAX = 140;

function snippet(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > SNIPPET_MAX ? `${clean.slice(0, SNIPPET_MAX)}…` : clean;
}

// Notifica a recepcao (notifications -> sino do dashboard) com o motivo
// e o trecho recente da conversa, para o atendimento humano assumir
// com contexto. Nunca derruba o fluxo de transferencia.
export async function notifyReceptionTransfer(
  conversation: Conversation,
  reason: string
): Promise<void> {
  try {
    const messages = await getMessages(conversation.id);
    const history = messages
      .slice(-HISTORY_LIMIT)
      .map((m) => `${m.sender === "patient" ? "Paciente" : "IA"}: ${snippet(m.content)}`)
      .join("\n");

    // clinic_id vem da linha da conversa (SELECT *) — a notificação do sino
    // nasce na mesma clínica que a conversa, não na "primeira da base".
    const clinicId = (conversation as { clinic_id?: number }).clinic_id;

    await createNotification({
      type: "transfer",
      title: "Conversa transferida para atendimento humano",
      clinic_id: clinicId,
      message: [
        `Telefone: ${conversation.phone}`,
        reason ? `Motivo: ${snippet(reason)}` : "",
        history ? `Últimas mensagens:\n${history}` : "Sem mensagens.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch (err) {
    console.error("[transfers] Falha ao notificar a recepcao:", err);
  }
}
