// ── Sanitizacao de input para protecao contra prompt injection ─────────
// Remove tentativas comuns de injecao de instrucoes, delimitadores
// abusivos e caracteres perigosos antes de enviar ao LLM.

// Padroes de prompt injection mais comuns
const INJECTION_PATTERNS = [
  // Instrucoes diretas ao sistema
  /^[\s]*(ignore|disregard|forget|override|ignore\s+all|new\s+instructions?|system\s*prompt|you\s+are\s+now|act\s+as\s+if)/i,
  // Tentativas de delimitador de sistema
  /(\[INST\]|\[SYS\]|<\|system\|>|<\|im_start\|>|<\|im_end\>|###\s*System|###\s*Instruction)/i,
  // Role hijacking
  /(you\s+are\s+no\s+longer|from\s+now\s+on\s+you|pretend\s+you\s+are|act\s+as\s+a\s+different|new\s+role)/i,
  // Tentativas de extrair o system prompt
  /(show\s+me\s+your\s+prompt|what\s+are\s+your\s+instructions|repeat\s+your\s+system|print\s+your\s+prompt|reveal\s+your\s+instructions)/i,
  // Delimitadores de mensagem perigosos
  /(---\s*BEGIN|---\s*END|===\s*SYSTEM|@@\s*ADMIN)/i,
];

// Caracteres de controle perigosos (mantem \n e \r normais)
const DANGEROUS_CHARS_REGEX = /[\x00-\x08\x0E-\x1F]/g;

// Tamanhos maximos
export const MAX_PATIENT_MESSAGE_LENGTH = 2000;
export const MAX_PATIENT_NAME_LENGTH = 200;
export const MAX_WEBHOOK_BODY_BYTES = 100_000; // 100KB

/**
 * Sanitiza a mensagem do paciente antes de enviar ao LLM.
 * Remove caracteres perigosos e detecta padroes de injecao.
 *
 * Retorna null se a mensagem for detectada como tentativa de injecao.
 */
export function sanitizePatientInput(text: string): string | null {
  // 1. Truncar para o tamanho maximo
  let cleaned = text.slice(0, MAX_PATIENT_MESSAGE_LENGTH);

  // 2. Remover caracteres de controle perigosos
  cleaned = cleaned.replace(DANGEROUS_CHARS_REGEX, "");

  // 3. Remover tentativas de injecao de prompt
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      // Em vez de rejeitar completamente (o paciente pode estar falando
      // naturalmente), apenas marca para o system prompt tratar com cautela.
      // Retorna a mensagem original mas sinaliza para o agente.
      return `[ATENCAO: mensagem do paciente pode conter instrucoes nao relacionadas ao agendamento]\n${cleaned}`;
    }
  }

  // 4. Normalizar espacos em branco excessivos
  cleaned = cleaned.replace(/\s{4,}/g, "   ");

  return cleaned;
}

/**
 * Sanitiza o nome do paciente.
 */
export function sanitizePatientName(name: string): string {
  return name
    .slice(0, MAX_PATIENT_NAME_LENGTH)
    .replace(DANGEROUS_CHARS_REGEX, "")
    .replace(/[<>]/g, "") // remove HTML basico
    .trim();
}

/**
 * Valida se o payload do webhook esta dentro do tamanho aceitavel.
 */
export function isValidPayloadSize(body: string, maxBytes: number = MAX_WEBHOOK_BODY_BYTES): boolean {
  return Buffer.byteLength(body, "utf-8") <= maxBytes;
}

/**
 * Embute a mensagem do paciente em delimitadores claros para o LLM,
 * reduzindo a chance de injecao via contexto.
 */
export function wrapMessageForLLM(patientMessage: string): string {
  return `--- INICIO DA MENSAGEM DO PACIENTE ---\n${patientMessage}\n--- FIM DA MENSAGEM DO PACIENTE ---`;
}
