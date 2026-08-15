import { db } from "@/lib/db";
import type { Doctor, DoctorSchedule } from "@/lib/types";

export interface DoctorView extends Doctor {
  specialty_name: string;
  schedule: DoctorSchedule[];
}

function rowToDoctor(row: Record<string, unknown>): Doctor {
  return {
    id: row.id as number,
    name: row.name as string,
    specialty_id: row.specialty_id as number,
    consultation_duration: row.consultation_duration as number,
    price: row.price as number,
    status: row.status as string,
    phone: (row.phone as string) ?? "",
  };
}

export function listDoctors(): DoctorView[] {
  const rows = db
    .prepare(
      `SELECT d.*, s.name AS specialty_name FROM doctors d
       JOIN specialties s ON s.id = d.specialty_id
       ORDER BY d.name`
    )
    .all();
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    const doctor = rowToDoctor(row);
    return {
      ...doctor,
      specialty_name: row.specialty_name as string,
      schedule: getDoctorSchedule(doctor.id),
    };
  });
}

export function getDoctor(id: number): Doctor | null {
  const row = db.prepare("SELECT * FROM doctors WHERE id = ?").get(id);
  return row ? rowToDoctor(row as Record<string, unknown>) : null;
}

export function getDoctorSchedule(doctorId: number): DoctorSchedule[] {
  const rows = db
    .prepare("SELECT * FROM doctor_schedule WHERE doctor_id = ? ORDER BY weekday, start_time")
    .all(doctorId);
  return rows as unknown as DoctorSchedule[];
}

export function getActiveDoctorsBySpecialty(specialtyId: number): Doctor[] {
  const rows = db
    .prepare("SELECT * FROM doctors WHERE specialty_id = ? AND status = 'active' ORDER BY name")
    .all(specialtyId);
  return rows.map((r) => rowToDoctor(r as Record<string, unknown>));
}

export function createDoctor(data: {
  name: string;
  specialty_id: number;
  consultation_duration?: number;
  price?: number;
  status?: string;
  phone?: string;
  schedule: { weekday: number; start_time: string; end_time: string }[];
}): DoctorView {
  const result = db
    .prepare(
      "INSERT INTO doctors (name, specialty_id, consultation_duration, price, status, phone) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      data.name,
      data.specialty_id,
      data.consultation_duration ?? 30,
      data.price ?? 0,
      data.status ?? "active",
      data.phone ?? ""
    );
  const id = Number(result.lastInsertRowid);
  const insertSchedule = db.prepare(
    "INSERT INTO doctor_schedule (doctor_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)"
  );
  for (const s of data.schedule) {
    insertSchedule.run(id, s.weekday, s.start_time, s.end_time);
  }
  return listDoctors().find((d) => d.id === id)!;
}

export function updateDoctor(
  id: number,
  data: {
    name?: string;
    specialty_id?: number;
    consultation_duration?: number;
    price?: number;
    status?: string;
    phone?: string;
    schedule?: { weekday: number; start_time: string; end_time: string }[];
  }
): DoctorView | null {
  const existing = getDoctor(id);
  if (!existing) return null;
  db.prepare(
    "UPDATE doctors SET name = ?, specialty_id = ?, consultation_duration = ?, price = ?, status = ?, phone = ? WHERE id = ?"
  ).run(
    data.name ?? existing.name,
    data.specialty_id ?? existing.specialty_id,
    data.consultation_duration ?? existing.consultation_duration,
    data.price ?? existing.price,
    data.status ?? existing.status,
    data.phone ?? existing.phone,
    id
  );
  if (data.schedule) {
    db.prepare("DELETE FROM doctor_schedule WHERE doctor_id = ?").run(id);
    const insertSchedule = db.prepare(
      "INSERT INTO doctor_schedule (doctor_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)"
    );
    for (const s of data.schedule) {
      insertSchedule.run(id, s.weekday, s.start_time, s.end_time);
    }
  }
  return listDoctors().find((d) => d.id === id)!;
}

export function deleteDoctor(id: number): void {
  db.prepare("DELETE FROM doctors WHERE id = ?").run(id);
}
