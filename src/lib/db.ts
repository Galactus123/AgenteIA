import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { hashSync } from "bcryptjs";

const isVercel = Boolean(process.env.VERCEL);
const dataDir = isVercel ? "/tmp" : path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "saudesync.db"));

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 10000;");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clinics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      opening_hours TEXT DEFAULT '',
      location TEXT DEFAULT '',
      social_media TEXT DEFAULT '{}',
      token_limit INTEGER NOT NULL DEFAULT 100000,
      base_token_limit INTEGER NOT NULL DEFAULT 100000,
      current_token_usage INTEGER NOT NULL DEFAULT 0,
      near_limit_notified INTEGER NOT NULL DEFAULT 0,
      overage_blocks_purchased INTEGER NOT NULL DEFAULT 0,
      subscription_status TEXT NOT NULL DEFAULT 'active',
      billing_cycle_day INTEGER NOT NULL DEFAULT 1,
      last_reset_at TEXT
    );

    CREATE TABLE IF NOT EXISTS clinic_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id),
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MZN',
      tokens INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      email TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS specialties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      keywords TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      specialty_id INTEGER NOT NULL REFERENCES specialties(id),
      consultation_duration INTEGER NOT NULL DEFAULT 30,
      price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      phone TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS doctor_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_name TEXT NOT NULL,
      patient_phone TEXT NOT NULL,
      specialty_id INTEGER NOT NULL REFERENCES specialties(id),
      doctor_id INTEGER NOT NULL REFERENCES doctors(id),
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      reason TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'ia',
      rescheduled INTEGER NOT NULL DEFAULT 0,
      reschedule_count INTEGER NOT NULL DEFAULT 0,
      conversation_id INTEGER REFERENCES conversations(id),
      cancelled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      patient_name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );
  `);

  // Migrations for existing databases
  try {
    db.exec("ALTER TABLE doctors ADD COLUMN phone TEXT DEFAULT ''");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE admins ADD COLUMN email TEXT DEFAULT ''");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE billing_events ADD COLUMN currency TEXT NOT NULL DEFAULT 'MZN'");
  } catch {
    // Column already exists
  }
  // Migrations de cota/uso de tokens da clínica (tenancy)
  const clinicColumns: [string, string][] = [
    ["token_limit", "INTEGER NOT NULL DEFAULT 100000"],
    ["base_token_limit", "INTEGER NOT NULL DEFAULT 100000"],
    ["current_token_usage", "INTEGER NOT NULL DEFAULT 0"],
    ["near_limit_notified", "INTEGER NOT NULL DEFAULT 0"],
    ["overage_blocks_purchased", "INTEGER NOT NULL DEFAULT 0"],
    ["subscription_status", "TEXT NOT NULL DEFAULT 'active'"],
    ["billing_cycle_day", "INTEGER NOT NULL DEFAULT 1"],
    ["last_reset_at", "TEXT"],
  ];
  for (const [name, def] of clinicColumns) {
    try {
      db.exec(`ALTER TABLE clinics ADD COLUMN ${name} ${def}`);
    } catch {
      // Column already exists
    }
  }
}

function seed() {
  db.exec("BEGIN IMMEDIATE");
  const clinicCount = db.prepare("SELECT COUNT(*) AS c FROM clinics").get() as { c: number };
  if (clinicCount.c > 0) {
    db.exec("COMMIT");
    return;
  }

  db.prepare(
    "INSERT INTO clinics (name, address, phone, whatsapp, opening_hours, location, social_media, token_limit, base_token_limit, current_token_usage, near_limit_notified, overage_blocks_purchased, subscription_status, billing_cycle_day, last_reset_at) VALUES (?, ?, ?, ?, ?, ?, ?, 100000, 100000, 0, 0, 0, 'active', 1, NULL)"
  ).run(
    "Clínica Vida",
    "Av. Julius Nyerere 1234, Maputo",
    "+258 21 300 000",
    "+258 84 000 0000",
    "Segunda a Sexta: 08h às 18h | Sábado: 08h às 13h",
    "Maputo, Moçambique",
    JSON.stringify({ facebook: "", instagram: "" })
  );

  db.prepare("INSERT INTO admins (username, password_hash, role, email) VALUES (?, ?, ?, ?)").run(
    "admin",
    hashSync("admin123", 10),
    "super_admin",
    "admin@saudesync.mz"
  );

  const specialties: [string, string, string[]][] = [
    [
      "Clínica Geral",
      "Atendimento médico geral para adultos e crianças acima de 2 anos. Primeira avaliação de qualquer problema de saúde.",
      ["dor de cabeça", "febre", "gripe", "dor de garganta", "dores no corpo", "pressão alta", "diabetes", "mal estar", "fadiga", "tosse"],
    ],
    [
      "Pediatria",
      "Atendimento médico para bebês e crianças, acompanhamento do crescimento e desenvolvimento.",
      ["filho", "bebê", "bebe", "criança", "crianca", "febre na criança", "crescimento", "vacinas", "refluxo do bebê"],
    ],
    [
      "Ginecologia",
      "Saúde da mulher: consultas de rotina, planejamento familiar, exames ginecológicos.",
      ["menstruação", "menstruacao", "gravidez", "corrimento", "cólica", "colica", "papanicolau", "planejamento familiar", "mama"],
    ],
    [
      "Dermatologia",
      "Tratamento de problemas de pele, cabelo e unhas: acne, manchas, alergias, queda de cabelo.",
      ["acne", "pele", "manchas", "coceira", "vermelhidão", "queda de cabelo", "caspa", "verruga", "micose", "alergia na pele"],
    ],
    [
      "Odontologia",
      "Saúde bucal: limpeza, restaurações, extrações, clareamento e tratamento de canal.",
      ["dente", "dor de dente", "gengiva", "sangramento na gengiva", "cárie", "carie", "limpeza dental", "canal", "aparelho", "prótese"],
    ],
    [
      "Oftalmologia",
      "Exames de visão, consultas de rotina e tratamento de doenças dos olhos.",
      ["visão", "visao", "olho", "vista", "óculos", "oculos", "lente", "coceira nos olhos", "vermelhidão nos olhos", "miopia"],
    ],
    [
      "Fisioterapia",
      "Reabilitação e tratamento de dores musculares, articulares e recuperação de lesões.",
      ["dor nas costas", "coluna", "joelho", "ombro", "lesão", "lesao", "entorse", "reabilitação", "reabilitacao", "torcicolo", "hérnia"],
    ],
    [
      "Psicologia",
      "Acompanhamento psicológico para ansiedade, estresse, depressão, luto e outras questões emocionais.",
      ["ansiedade", "estresse", "depressão", "depressao", "angústia", "angustia", "insônia", "insonia", "luto", "medo", "terapia", "pânico"],
    ],
  ];

  const insertSpecialty = db.prepare(
    "INSERT INTO specialties (name, description, keywords) VALUES (?, ?, ?)"
  );
  for (const [name, description, keywords] of specialties) {
    insertSpecialty.run(name, description, JSON.stringify(keywords));
  }

  const doctors: [string, string, number, number, string, [number, string, string][]][] = [
    ["Dra. Ana Martins", "Clínica Geral", 30, 800, "+258 84 123 4567", [[1, "08:00", "12:00"], [1, "14:00", "17:00"], [3, "08:00", "12:00"], [5, "08:00", "12:00"]]],
    ["Dr. Carlos Mendes", "Pediatria", 30, 900, "+258 85 234 5678", [[2, "08:00", "12:00"], [4, "08:00", "12:00"], [4, "14:00", "17:00"], [6, "08:00", "11:00"]]],
    ["Dra. Beatriz Lopes", "Ginecologia", 40, 1200, "+258 86 345 6789", [[1, "08:00", "12:00"], [2, "14:00", "17:00"], [3, "08:00", "12:00"], [5, "14:00", "17:00"]]],
    ["Dr. João Ferreira", "Dermatologia", 30, 1000, "+258 84 456 7890", [[2, "08:00", "12:00"], [3, "14:00", "17:00"], [6, "08:00", "11:00"]]],
    ["Dr. Miguel Sousa", "Odontologia", 45, 700, "+258 85 567 8901", [[1, "08:00", "12:00"], [2, "08:00", "12:00"], [4, "14:00", "17:00"], [5, "08:00", "12:00"]]],
    ["Dra. Sofia Nunes", "Oftalmologia", 30, 1000, "+258 86 678 9012", [[3, "08:00", "12:00"], [4, "08:00", "12:00"], [6, "08:00", "11:00"]]],
    ["Dr. Pedro Almeida", "Fisioterapia", 40, 600, "+258 84 789 0123", [[1, "08:00", "12:00"], [2, "14:00", "17:00"], [4, "08:00", "12:00"], [5, "08:00", "12:00"]]],
    ["Dra. Rita Carvalho", "Psicologia", 50, 1100, "+258 85 890 1234", [[2, "08:00", "12:00"], [3, "14:00", "17:00"], [5, "14:00", "17:00"]]],
  ];

  const insertDoctor = db.prepare(
    "INSERT INTO doctors (name, specialty_id, consultation_duration, price, status, phone) VALUES (?, ?, ?, ?, 'active', ?)"
  );
  const insertSchedule = db.prepare(
    "INSERT INTO doctor_schedule (doctor_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)"
  );
  for (const [name, specialtyName, duration, price, phone, schedule] of doctors) {
    const spec = db
      .prepare("SELECT id FROM specialties WHERE name = ?")
      .get(specialtyName) as { id: number };
    const res = insertDoctor.run(name, spec.id, duration, price, phone);
    const doctorId = Number(res.lastInsertRowid);
    for (const [weekday, start, end] of schedule) {
      insertSchedule.run(doctorId, weekday, start, end);
    }
  }

  db.exec("COMMIT");
}

migrate();
// Durante o build (next build), os workers coletam dados das rotas em paralelo e o
// seed usa uma transação de escrita (BEGIN IMMEDIATE) — isso causa "database is locked"
// quando vários processos tentam popular o mesmo arquivo ao mesmo tempo.
// O seed é executado apenas em tempo de execução.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  try {
    seed();
  } catch {
    // se já foi populado por outro processo concorrente, ignora
  }
}
