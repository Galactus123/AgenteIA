import { callLlm, isLlmConfigured, type LlmMessage } from "@/lib/agent/llm";
import { toolDefinitions, executeTool } from "@/lib/agent/tools";
import { buildSystemPrompt } from "@/lib/agent/prompts";
import { addMessage, getMessages, getConversation, updateConversation, getOrCreateConversation } from "@/lib/services/conversations";
import { blockForQuota, consumeTokens, hasAiQuota } from "@/lib/services/subscriptions";
import { PlanLimitError, canUseAI, getAiUsage, incrementAiUsage } from "@/lib/services/plan-limits";
import { sanitizePatientInput } from "@/lib/agent/security";
import {
  HUMAN_TRANSFER_NOTICE,
  TRANSFER_WAITING_REPLY,
  notifyReceptionTransfer,
} from "@/lib/services/transfers";
import type { Conversation, Message } from "@/lib/types";

const MAX_ITERATIONS = 8;

const NO_KEY_MESSAGE =
  "Olá! Ainda estou em manutenção: a chave de IA não foi configurada. Peço desculpas. Você pode me contactar pelo telefone da clínica, e assim que eu estiver pronto retomo o atendimento por aqui. 😊";

const LLM_ERROR_MESSAGE =
  "Desculpe, tive um problema momentâneo ao processar sua mensagem. Pode tentar novamente? Se preferir, um atendente da recepção pode te ajudar agora.";

const QUOTA_EXHAUSTED_MESSAGE =
  "Olá! Para te dar o melhor atendimento, estou transferindo sua conversa para a nossa equipe de recepção. Um de nossos atendentes falará com você em instantes!";

// Limite de plano (conversas ativas ou interações de IA do período): o
// paciente não precisa saber de planos — o log técnico fica no servidor.
const PLAN_LIMIT_MESSAGE =
  "Olá! Meu atendimento automático atingiu o limite deste período. Deixe sua mensagem por aqui que a nossa recepção responde em breve, ou ligue para a clínica. 😊";

const FALLBACK_BASE =
  "Ainda estou aqui! 😊 Para te ajudar a marcar uma consulta, me conta o que você está sentindo ou qual especialidade você procura. Se preferir, posso te transferir para um atendente.";

type AgentReply = {
  reply: string;
  conversationId: number | null;
  transferred: boolean;
};

function log(...args: unknown[]): void {
  console.log(`[agent:${new Date().toISOString()}]`, ...args);
}

function logError(...args: unknown[]): void {
  console.error(`[agent:${new Date().toISOString()}]`, ...args);
}

export async function handlePatientMessage(
  phone: string,
  text: string,
  clinicId?: number | null
): Promise<AgentReply> {
  const clinic = clinicId ?? undefined;

  // Sanitizar input do paciente contra prompt injection
  const sanitizedText = sanitizePatientInput(text);
  if (!sanitizedText) {
    log("Mensagem rejeitada por seguranca (prompt injection detectado).");
    const safeReply = "Desculpe, nao consegui processar sua mensagem. Pode reformular?";
    const conversation = await resolveConversation(phone, clinic);
    if (!conversation) return { reply: safeReply, conversationId: null, transferred: false };
    await addMessage(conversation.id, "bot", safeReply);
    return { reply: safeReply, conversationId: conversation.id, transferred: false };
  }

  const conversation = await resolveConversation(phone, clinic);
  if (!conversation) {
    // Limite de conversas ativas do plano: sem linha nova nao ha historico
    // para gravar — respondemos o paciente e deixamos a falha no log.
    log(`Conversa nova bloqueada pelo limite do plano (phone=${phone}).`);
    return { reply: PLAN_LIMIT_MESSAGE, conversationId: null, transferred: false };
  }
  log(`Conversa carregada/criada para phone=${phone} id=${conversation.id}, status="${conversation.status}"`);

  // Fase 3.5 — a conversa ja foi transferida: a IA fica FORA do
  // atendimento. Grava a mensagem do paciente, responde o padrao de
  // espera e nao chama o LLM (sem custo de tokens, sem alucinacao).
  if (conversation.status === "transferred") {
    log(`Conversa ${conversation.id} ja transferida — IA fora do atendimento.`);
    await addMessage(conversation.id, "patient", sanitizedText);
    await addMessage(conversation.id, "bot", TRANSFER_WAITING_REPLY);
    return { reply: TRANSFER_WAITING_REPLY, conversationId: conversation.id, transferred: false };
  }

  // Bloqueio por cota: com a cota restaurada a IA retoma (status volta
  // a "open"); se ainda esgotada, mantem a IA fora e repete o aviso.
  if (conversation.status === "WAITING_HUMAN_INTERVENTION") {
    if (await hasAiQuota(clinic)) {
      log(`Conversa ${conversation.id}: cota restaurada — retomando o atendimento da IA.`);
      await updateConversation(conversation.id, { status: "open" });
    } else {
      log(`Conversa ${conversation.id}: cota esgotada — IA continua fora.`);
      await addMessage(conversation.id, "patient", sanitizedText);
      await addMessage(conversation.id, "bot", QUOTA_EXHAUSTED_MESSAGE);
      return { reply: QUOTA_EXHAUSTED_MESSAGE, conversationId: conversation.id, transferred: false };
    }
  }

  await addMessage(conversation.id, "patient", sanitizedText);
  log(`Mensagem do paciente [${conversation.id}] gravada (tamanho=${sanitizedText.length})`);

  // Guard de plano: interações de IA do período (usage.ai_interactions x
  // plan.limits.maxAiInteractions). Sem chamada ao LLM, sem custo — o
  // paciente recebe um aviso neutro e no proximo periodo a IA retoma.
  if (!(await canUseAI(clinic))) {
    const aiUsage = await getAiUsage(clinic);
    log(
      `Limite de interações IA do plano ${aiUsage.planName} atingido (${aiUsage.current}/${aiUsage.limit}). Sem chamada de LLM.`
    );
    await addMessage(conversation.id, "bot", PLAN_LIMIT_MESSAGE);
    return { reply: PLAN_LIMIT_MESSAGE, conversationId: conversation.id, transferred: false };
  }

  if (!isLlmConfigured()) {
    log("LLM não configurado (OPENAI_API_KEY ausente). Retornando NO_KEY_MESSAGE.");
    await addMessage(conversation.id, "bot", NO_KEY_MESSAGE);
    return { reply: NO_KEY_MESSAGE, conversationId: conversation.id, transferred: false };
  }

  // Guard pré-chamada: bloqueia a chamada de IA quando a cota de tokens da clínica está esgotada.
  if (!(await hasAiQuota(clinic))) {
    log(`Cota de tokens esgotada para phone=${phone}. Transferindo para atendimento humano.`);
    return blockConversationForQuota(conversation.id, phone, clinic);
  }

  const history = await getMessages(conversation.id);
  log(`Histórico completo carregado: ${history.length} mensagens para conversation_id=${conversation.id}`);

  // Monta o contexto completo: system prompt + historico integral + nova mensagem
  const hasHistory = history.length > 1;
  const systemPrompt = await buildSystemPrompt(hasHistory);
  const messages: LlmMessage[] = [{ role: "system", content: systemPrompt }];

  let patientCount = 0;
  let botCount = 0;
  for (const msg of history) {
    if (msg.sender === "patient") {
      // Aplicar sanitizacao tambem no historico carregado do banco
      const safeContent = sanitizePatientInput(msg.content) ?? msg.content;
      messages.push({ role: "user", content: safeContent });
      patientCount++;
    } else if (msg.sender === "bot") {
      messages.push({ role: "assistant", content: msg.content });
      botCount++;
    } else {
      log(`Mensagem de sender "${msg.sender}" ignorada no contexto (sistema).`);
    }
  }
  log(`Contexto montado → ${messages.length} mensagens enviadas ao LLM (${patientCount} do paciente, ${botCount} do bot).`);

  if (patientCount === 0) {
    logError("ALERTA: Nenhuma mensagem do paciente encontrada no histórico. Verificar persistência.");
  }

  let transferred = false;

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (!(await hasAiQuota(clinic))) {
        log(`Cota de tokens esgotada na iteração ${i + 1}. Transferindo para atendimento humano.`);
        return blockConversationForQuota(conversation.id, phone, clinic);
      }
      log(`Iteração ${i + 1}/${MAX_ITERATIONS}: chamando LLM (${messages.length} mensagens no payload).`);
      const response = await callLlm(messages, toolDefinitions);
      // Conta a interação no corte do plano (usage.ai_interactions) — feito
      // antes do consumo de tokens: a chamada aconteceu, custou e conta.
      await incrementAiUsage(clinic);
      if (response.totalTokens > 0) {
        const { nearLimitAlert } = await consumeTokens(response.totalTokens, clinic);
        if (nearLimitAlert) {
          log(`Alerta de 80% da cota emitido para a clínica (${response.totalTokens} tokens consumidos nesta chamada).`);
        }
      }
      log(`LLM respondeu na iteração ${i + 1}: content=${response.content ? `"${response.content.slice(0, 120)}"` : null}, toolCalls=${response.toolCalls.length}, totalTokens=${response.totalTokens}`);

      if (response.toolCalls.length > 0) {
        log(`Processando ${response.toolCalls.length} tool call(s) na iteração ${i + 1}: ${response.toolCalls.map((t) => t.function.name).join(", ")}`);
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: response.toolCalls,
        });

        for (const toolCall of response.toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
            log(`Tool "${toolCall.function.name}" arguments parseados:`, args);
          } catch {
            logError(`Falha ao parsear arguments da tool "${toolCall.function.name}": ${toolCall.function.arguments}`);
            args = {};
          }
          const result = await executeTool(toolCall.function.name, args, {
            conversationId: conversation.id,
          });
          log(`Tool "${toolCall.function.name}" executada → output=${result.output.slice(0, 200)}${result.transferToHuman ? " [TRANSFER_TO_HUMAN]" : ""}`);
          if (result.transferToHuman) {
            transferred = true;
            await updateConversation(conversation.id, { status: "transferred" });
            await notifyReceptionTransfer(conversation, result.transferReason ?? "");
            log(`Conversa ${conversation.id} marcada como transferred; recepcao notificada.`);
          }
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.output,
          });
        }
        // Fase 3.5: encerra a participacao da IA — nao continuar o
        // loop apos transfer_to_human.
        if (transferred) break;
        continue;
      }

      if (response.content) {
        log(`Resposta final gerada na iteração ${i + 1}: "${response.content.slice(0, 150)}"`);
        await addMessage(conversation.id, "bot", response.content);
        return { reply: response.content, conversationId: conversation.id, transferred };
      }

      log(`Iteração ${i + 1}: LLM retornou sem content e sem tool_calls. Interrompendo loop para evitar loop infinito.`);
      break;
    }

    // Saida por transferencia: a IA se despede com o aviso padrao e
    // sai de cena (o webhook entrega via outbox).
    if (transferred) {
      await addMessage(conversation.id, "bot", HUMAN_TRANSFER_NOTICE);
      log(`Aviso de transferencia registrado para a conversa ${conversation.id}.`);
      return { reply: HUMAN_TRANSFER_NOTICE, conversationId: conversation.id, transferred: true };
    }

    // Caiu no limite de iterações sem gerar uma resposta final útil.
    const fallback = buildContextAwareFallback(history);
    log(`Loop atingiu o limite (${MAX_ITERATIONS}) sem resposta final. Registrando fallback consciente.`);
    await addMessage(conversation.id, "bot", fallback);
    return { reply: fallback, conversationId: conversation.id, transferred };
  } catch (err) {
    logError("Erro processando a mensagem no agente:", err);
    await addMessage(conversation.id, "bot", LLM_ERROR_MESSAGE);
    return { reply: LLM_ERROR_MESSAGE, conversationId: conversation.id, transferred };
  }
}

// Em vez de repetir a mesma mensagem genérica, tenta produzir uma resposta útil
// baseada no fluxo real da conversa (evita o fallback genérico repetitivo).
async function blockConversationForQuota(
  conversationId: number,
  phone: string,
  clinicId?: number
): Promise<AgentReply> {
  await addMessage(conversationId, "bot", QUOTA_EXHAUSTED_MESSAGE);
  await updateConversation(conversationId, { status: "WAITING_HUMAN_INTERVENTION" });
  await blockForQuota(phone, clinicId);
  log(`Conversa ${conversationId} marcada como WAITING_HUMAN_INTERVENTION por cota esgotada.`);
  return { reply: QUOTA_EXHAUSTED_MESSAGE, conversationId, transferred: true };
}

// Cria (ou carrega) a conversa; devolve null quando o plano não permite
// mais conversas ativas — PlanLimitError vira resposta neutra ao paciente.
async function resolveConversation(
  phone: string,
  clinicId?: number
): Promise<Conversation | null> {
  try {
    return await getOrCreateConversation(phone, clinicId);
  } catch (err) {
    if (err instanceof PlanLimitError) {
      log(`Limite de conversas do plano ${err.planName}: ${err.message}`);
      return null;
    }
    throw err;
  }
}

function buildContextAwareFallback(history: Message[]): string {
  const hasPatientName = history.some(
    (m) => m.sender === "patient" && /\b(meu nome|sou|é o|me chamo|chamo-me|chamo me)\b/i.test(m.content)
  );
  const hasSymptom = history.some(
    (m) => m.sender === "patient" && /dor|febre|sintoma|sentindo|sinto|dores|tosse|enjoo|dor de cabeça|dores de cabeça/i.test(m.content)
  );

  if (hasSymptom) {
    return "Entendi que você está com algum sintoma. 😊 Para indicar a especialidade certa, me conta melhor: onde dói e há quanto tempo? Se preferir, posso te transferir para um atendente.";
  }
  if (!hasPatientName) {
    return "Ótimo! Para eu poder marcar sua consulta, me diz seu nome, por favor? 😊";
  }
  return FALLBACK_BASE;
}

export async function getConversationMessages(conversationId: number): Promise<{
  conversation: Conversation | null;
  messages: Message[];
}> {
  const [conversation, messages] = await Promise.all([
    getConversation(conversationId),
    getMessages(conversationId),
  ]);
  return { conversation, messages };
}

export { getOrCreateConversation, getMessages, updateConversation };
