import { db } from "@/lib/db";
import type { Specialty } from "@/lib/types";

function parseKeywords(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToSpecialty(row: Record<string, unknown>): Specialty {
  return {
    id: row.id as number,
    name: row.name as string,
    description: row.description as string,
    keywords: parseKeywords(row.keywords as string),
  };
}

export function listSpecialties(): Specialty[] {
  const rows = db.prepare("SELECT * FROM specialties ORDER BY name").all();
  return rows.map(rowToSpecialty);
}

export function getSpecialty(id: number): Specialty | null {
  const row = db.prepare("SELECT * FROM specialties WHERE id = ?").get(id);
  return row ? rowToSpecialty(row as Record<string, unknown>) : null;
}

export function createSpecialty(data: { name: string; description?: string; keywords?: string[] }): Specialty {
  const result = db
    .prepare("INSERT INTO specialties (name, description, keywords) VALUES (?, ?, ?)")
    .run(data.name, data.description ?? "", JSON.stringify(data.keywords ?? []));
  return getSpecialty(Number(result.lastInsertRowid))!;
}

export function updateSpecialty(
  id: number,
  data: { name?: string; description?: string; keywords?: string[] }
): Specialty | null {
  const existing = getSpecialty(id);
  if (!existing) return null;
  db.prepare("UPDATE specialties SET name = ?, description = ?, keywords = ? WHERE id = ?").run(
    data.name ?? existing.name,
    data.description ?? existing.description,
    JSON.stringify(data.keywords ?? existing.keywords),
    id
  );
  return getSpecialty(id);
}

export function deleteSpecialty(id: number): void {
  db.prepare("DELETE FROM specialties WHERE id = ?").run(id);
}
