export type AppointmentStatus = "scheduled" | "cancelled" | "completed";

export interface Clinic {
  id: number;
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  opening_hours: string;
  location: string;
  social_media: string;
}

export interface Specialty {
  id: number;
  name: string;
  description: string;
  keywords: string[];
}

export interface Doctor {
  id: number;
  name: string;
  specialty_id: number;
  consultation_duration: number;
  price: number;
  status: string;
  phone: string;
}

export interface DoctorSchedule {
  id: number;
  doctor_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface Appointment {
  id: number;
  patient_name: string;
  patient_phone: string;
  specialty_id: number;
  doctor_id: number;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  reason: string;
  source: string;
  rescheduled: number;
  reschedule_count: number;
  conversation_id: number | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentView extends Appointment {
  specialty_name: string;
  doctor_name: string;
  clinic_name: string;
  clinic_address: string;
  consultation_duration: number;
  price: number;
}

export interface Conversation {
  id: number;
  phone: string;
  patient_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender: "patient" | "bot" | "system";
  content: string;
  created_at: string;
}

export interface AvailableSlot {
  doctor_id: number;
  doctor_name: string;
  specialty_id: number;
  specialty_name: string;
  starts_at: string;
  ends_at: string;
  price: number;
}
