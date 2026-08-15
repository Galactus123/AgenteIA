import { db } from "@/lib/db";
import type { Conversation, Message } from "@/lib/types";
import { nowStr } from "@/lib/datetime";

export function getOrCreateConversation(phone: string): Conversation {
  const normalized = phone.replace(/\D/g, "");
  const now = nowStr();

  // Bloqueia a tabela para evitar race condition na criação concorrente
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db
      .prepare("SELECT * FROM conversations WHERE phone = ?")
      .get(normalized) as Conversation | undefined;
    if (existing) {
      db.exec("COMMIT");
      return existing;
    }
    const result = db
      .prepare(
        "INSERT INTO conversations (phone, patient_name, status, created_at, updated_at) VALUES (?, '', 'open', ?, ?)"
      )
      .run(normalized, now, now);
    const conversation = db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as unknown as Conversation;
    db.exec("COMMIT");
    return conversation;
  } catch (err) {
    db.exec("ROLLBACK");
    // Se outro processo criou a conversa simultaneamente, busca a existente
    const fallback = db
      .prepare("SELECT * FROM conversations WHERE phone = ?")
      .get(normalized) as Conversation | undefined;
    if (fallback) return fallback;
    throw err;
  }
}

export function getConversation(id: number): Conversation | null {
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  return row ? (row as unknown as Conversation) : null;
}

export function getConversationByPhone(phone: string): Conversation | null {
  const normalized = phone.replace(/\D/g, "");
  const row = db.prepare("SELECT * FROM conversations WHERE phone = ?").get(normalized);
  return row ? (row as unknown as Conversation) : null;
}

export function updateConversation(id: number, data: { patient_name?: string; status?: string }): void {
  const existing = getConversation(id);
  if (!existing) return;
  db.prepare("UPDATE conversations SET patient_name = ?, status = ?, updated_at = ? WHERE id = ?").run(
    data.patient_name ?? existing.patient_name,
    data.status ?? existing.status,
    nowStr(),
    id
  );
}

export function addMessage(conversationId: number, sender: Message["sender"], content: string): Message {
  const result = db
    .prepare("INSERT INTO messages (conversation_id, sender, content, created_at) VALUES (?, ?, ?, ?)")
    .run(conversationId, sender, content, nowStr());
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(nowStr(), conversationId);
  return db
    .prepare("SELECT * FROM messages WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as unknown as Message;
}

export function getMessages(conversationId: number): Message[] {
  return db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC")
    .all(conversationId) as unknown as Message[];
}

export function listConversations(): Conversation[] {
  return db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all() as unknown as Conversation[];
}
