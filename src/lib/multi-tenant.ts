// ── Multi-Tenant — Isolamento por Clinic ID ───────────────────────────
// Garante que todas as queries filtram por clinic_id para isolar dados
// entre clinicas no mesmo banco de dados.

import { db } from "@/lib/db";
import type { SQLInputValue } from "node:sqlite";

/**
 * Retorna o clinic_id padrao (unica clinica no sistema).
 * Em producao multi-tenant, isso deve ser resolvido via JWT/session.
 */
export function getDefaultClinicId(): number {
  const clinic = db.prepare("SELECT id FROM clinics LIMIT 1").get() as { id: number } | undefined;
  return clinic?.id ?? 1;
}

/**
 * Migracao para adicionar clinic_id nas tabelas que ainda nao tem.
 * Executar uma unica vez no deploy.
 */
export function migrateMultiTenant(): void {
  const columnsToAdd: [string, string, string][] = [
    ["admins", "clinic_id", "INTEGER REFERENCES clinics(id) DEFAULT 1"],
    ["doctors", "clinic_id", "INTEGER REFERENCES clinics(id) DEFAULT 1"],
    ["specialties", "clinic_id", "INTEGER REFERENCES clinics(id) DEFAULT 1"],
    ["conversations", "clinic_id", "INTEGER REFERENCES clinics(id) DEFAULT 1"],
    ["appointments", "clinic_id", "INTEGER REFERENCES clinics(id) DEFAULT 1"],
    ["notifications", "clinic_id", "INTEGER REFERENCES clinics(id) DEFAULT 1"],
    ["users", "clinic_id", "INTEGER REFERENCES clinics(id) DEFAULT 1"],
    ["reminders", "clinic_id", "INTEGER REFERENCES clinics(id) DEFAULT 1"],
  ];

  for (const [table, column, def] of columnsToAdd) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
      console.log(`[multi-tenant] Coluna ${table}.${column} adicionada`);
    } catch {
      // Coluna ja existe
    }
  }

  // Popular clinic_id nas linhas existentes que nao tem
  const defaultClinicId = getDefaultClinicId();
  for (const table of ["admins", "doctors", "specialties", "conversations", "appointments", "notifications", "users", "reminders"]) {
    try {
      db.prepare(`UPDATE ${table} SET clinic_id = ? WHERE clinic_id IS NULL`).run(defaultClinicId);
    } catch {
      // Tabela pode nao ter a coluna ainda
    }
  }
}

/**
 * Wrapper para queries que automaticamente filtra por clinic_id.
 * Uso: scopedQuery("SELECT * FROM doctors WHERE status = ?", ["active"])
 */
export function scopedQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  clinicId?: number
): T[] {
  const cid = clinicId ?? getDefaultClinicId();

  // Inserir condicao WHERE ou AND clinic_id = ?
  let scopedSql: string;
  if (/WHERE/i.test(sql)) {
    scopedSql = sql.replace(/WHERE/i, `WHERE clinic_id = ? AND`);
  } else if (/SELECT\s+\*/i.test(sql)) {
    scopedSql = sql.replace(/SELECT\s+\*/i, `SELECT *`);
    // Adicionar WHERE se nao existir
    if (!/WHERE/i.test(scopedSql)) {
      scopedSql += ` WHERE clinic_id = ?`;
    }
  } else {
    scopedSql = sql;
  }

  const allParams = [cid, ...params] as SQLInputValue[];
  return db.prepare(scopedSql).all(...allParams) as T[];
}

/**
 * Wrapper para INSERT que automaticamente adiciona clinic_id.
 */
export function scopedInsert(
  table: string,
  data: Record<string, unknown>,
  clinicId?: number
): { lastInsertRowid: number | string; changes: number } {
  const cid = clinicId ?? getDefaultClinicId();
  const insertData = { clinic_id: cid, ...data };

  const cols = Object.keys(insertData);
  const placeholders = cols.map(() => "?").join(", ");
  const values = Object.values(insertData);

  const allValues = values as SQLInputValue[];
  const result = db
    .prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`)
    .run(...allValues);

  return {
    lastInsertRowid: Number(result.lastInsertRowid) as number,
    changes: Number(result.changes),
  };
}

/**
 * Verifica se uma tabela tem a coluna clinic_id.
 */
export function hasClinicId(table: string): boolean {
  try {
    const result = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return result.some((col) => col.name === "clinic_id");
  } catch {
    return false;
  }
}
