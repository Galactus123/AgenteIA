// Busca global (dashboard): contrato puro partilhado entre o servico de
// busca (server) e o combobox do cabecalho (client). Este modulo NAO importa
// Supabase nem nada de servidor, para o componente poder importa-lo à vontade.

export type SearchKind = "paciente" | "medico" | "consulta" | "especialidade";

export interface SearchHit {
  // Identificador do recurso (uuid ou bigint) — usado só para navegar.
  id: string;
  kind: SearchKind;
  // Nome principal do registo (ex.: nome do paciente).
  title: string;
  // Linha secundaria ja formatada (ex.: "Paciente • (84) 99999-9999").
  description: string;
  // Rota de destino com deep link (?id= e ancora quando faz sentido).
  href: string;
}

export interface SearchResponse {
  query: string;
  results: SearchHit[];
}

// Menos que 2 caracteres gera mais ruido do que resultado (scan por ilike em
// 4 tabelas): o cliente mostra um aviso em vez de ir à rede.
export const SEARCH_MIN_CHARS = 2;

// Tope por categoria para o dropdown não virar uma lista infinita.
export const SEARCH_LIMIT = 5;

// Corta primeiro no cliente e de novo no servidor (a rota recebe o valor cru
// do query string).
export const SEARCH_MAX_QUERY = 80;

/**
 * Remove os caracteres que fariam o `or()` do PostgREST (col.op.valor,...)
 * partir ou injetar cláusulas extras, colapsa espaços e limita o tamanho.
 * Aspas, vírgulas, parênteses e barra invertida nunca aparecem numa busca
 * por nome/telefone/documento — fora isso o termo é preservado.
 */
export function sanitizeQuery(raw: string): string {
  return raw
    .slice(0, SEARCH_MAX_QUERY)
    .replace(/["'`,()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Variações do termo para o ilike: o próprio termo e, quando ele contém
 * dígitos, a versão só com dígitos (o utilizador pode digitar o telefone
 * "84 99999-9999" ou "84999999999" e o banco guarda de uma forma só).
 */
export function buildPatterns(query: string): string[] {
  const digits = query.replace(/\D+/g, "");
  if (digits.length >= 4 && digits.length < query.length) {
    return [query, digits];
  }
  return [query];
}

/**
 * Variantes de data em formato brasileiro para a coluna `starts_at` (ISO):
 * "16/10" → "10-16" (subcadeia de "2026-10-16"), "16/10/2026" → "2026-10-16".
 * Devolve [] quando o termo não parece uma data.
 */
export function datePatterns(query: string): string[] {
  const m = query.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!m) return [];
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  if (!m[3]) return [`${month}-${day}`];
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return [`${year}-${month}-${day}`, `${month}-${day}`];
}

/**
 * Expressão `or=` com ilike em várias colunas: cada termo vira
 * `col1.ilike."termo",col2.ilike."termo"`. Os valores vão entre aspas porque
 * o parser do PostgREST trata vírgulas, pontos, dois-pontos e parênteses como
 * reservados (ex.: "16/10/2026" → "2026-10-16") — aspas delimitam o valor.
 * Seguro porque sanitizeQuery remove aspas e barra invertida do termo.
 */
export function orIlike(columns: string[], patterns: string[]): string | null {
  const clauses = columns.flatMap((column) =>
    patterns.map((pattern) => `${column}.ilike."${pattern}"`)
  );
  return clauses.length > 0 ? clauses.join(",") : null;
}

export const KIND_LABEL: Record<SearchKind, string> = {
  paciente: "Pacientes",
  medico: "Profissionais",
  consulta: "Consultas",
  especialidade: "Especialidades",
};
