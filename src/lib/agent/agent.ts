import { callLlm, isLlmConfigured, type LlmMessage } from "@/lib/agent/llm";
import { toolDefinitions, executeTool } from "@/lib/agent/tools";
import { buildSystemPrompt } from "@/lib/agent/prompts";
import { addMessage, getMessages, getConversation, updateConversation, getOrCreateConversation } from "@/lib/services/conversations";

const MAX_ITERATIONS = 8;

const NO_KEY_MESSAGE =
  "Olá! Ainda estou em manutenção: a chave de IA não foi configurada. Peço desculpas. Você pode me contactar pelo telefone da clínica, e assim que eu estiver pronto retomo o atendimento por aqui. 😊";

const LLM_ERROR_MESSAGE =
  "Desculpe, tive um problema momentâneo ao processar sua mensagem. Pode tentar novamente? Se preferir, um atendente da recepção pode te ajudar agora.";

const FALLBACK_BASE =
  "Ainda estou aqui! 😊 Para te ajudar a marcar uma consulta, me conta o que você está sentindo ou qual especialidade você procura. Se preferir, posso transferir para um atendente.";

function log(...args: unknown[]): void {
  console.log(`[agent:${new Date().toISOString()}]`, ...args);
}

function logError(...args: unknown[]): void {
  console.error(`[agent:${new Date().toISOString()}]`, ...args);
}

export async function handlePatientMessage(phone: string, text: string): Promise<{
  reply: string;
  conversationId: number;
  transferred: boolean;
}> {
  const conversation = getOrCreateConversation(phone);
  log(`Conversa carregada/criada para phone=${phone} → id=${conversation.id}, status="${conversation.status}"`);
  addMessage(conversation.id, "patient", text);
  log(`Mensagem do paciente [${conversation.id}] gravada: "${text}"`);

  if (!isLlmConfigured()) {
    log("LLM não configurado (OPENAI_API_KEY ausente). Retornando NO_KEY_MESSAGE.");
    addMessage(conversation.id, "bot", NO_KEY_MESSAGE);
    return { reply: NO_KEY_MESSAGE, conversationId: conversation.id, transferred: false };
  }

  const history = getMessages(conversation.id);
  log(`Histórico completo carregado: ${history.length} mensagens para conversation_id=${conversation.id}`);

  // Monta o contexto completo: system prompt + histórico integral + nova mensagem
  const hasHistory = history.length > 1; // mais de 1 = já teve interações anteriores
  const systemPrompt = buildSystemPrompt(hasHistory);
  const messages: LlmMessage[] = [{ role: "system", content: systemPrompt }];

  let patientCount = 0;
  let botCount = 0;
  for (const msg of history) {
    if (msg.sender === "patient") {
      messages.push({ role: "user", content: msg.content });
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
      log(`Iteração ${i + 1}/${MAX_ITERATIONS}: chamando LLM (${messages.length} mensagens no payload).`);
      const response = await callLlm(messages, toolDefinitions);
      log(`LLM respondeu na iteração ${i + 1}: content=${response.content ? `"${response.content.slice(0, 120)}"` : null}, toolCalls=${response.toolCalls.length}`);

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
            updateConversation(conversation.id, { status: "transferred" });
            log(`Conversa ${conversation.id} marcada como transferred.`);
          }
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.output,
          });
        }
        continue;
      }

      if (response.content) {
        log(`Resposta final gerada na iteração ${i + 1}: "${response.content.slice(0, 150)}"`);
        addMessage(conversation.id, "bot", response.content);
        return { reply: response.content, conversationId: conversation.id, transferred };
      }

      log(`Iteração ${i + 1}: LLM retornou sem content e sem tool_calls. Interrompendo loop para evitar loop infinito.`);
      break;
    }

    // Caiu no limite de iterações sem gerar uma resposta final útil.
    const fallback = buildContextAwareFallback(history);
    log(`Loop atingiu o limite (${MAX_ITERATIONS}) sem resposta final. Registrando fallback consciente.`);
    addMessage(conversation.id, "bot", fallback);
    return { reply: fallback, conversationId: conversation.id, transferred };
  } catch (err) {
    logError("Erro processando a mensagem no agente:", err);
    addMessage(conversation.id, "bot", LLM_ERROR_MESSAGE);
    return { reply: LLM_ERROR_MESSAGE, conversationId: conversation.id, transferred };
  }
}

// Em vez de repetir a mesma mensagem genérica, tenta produzir uma resposta útil
// baseada no fluxo real da conversa (evita o fallback genérico repetitivo).
function buildContextAwareFallback(history: { sender: string; content: string }[]): string {
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

export function getConversationMessages(conversationId: number) {
  return {
    conversation: getConversation(conversationId),
    messages: getMessages(conversationId),
  };
}

export { getOrCreateConversation, getMessages, updateConversation };
