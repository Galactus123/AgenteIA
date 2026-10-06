export type AppointmentStatus =
  | "scheduled"
  | "cancelled"
  | "completed"
  | "no_show";

export interface Clinic {
  id: number;
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  opening_hours: string;
  location: string;
  social_media: string;
  token_limit: number;
  base_token_limit: number;
  current_token_usage: number;
  near_limit_notified: number;
  overage_blocks_purchased: number;
  // Instância WhatsApp Komunika própria da clínica (migração
  // 20261006000002); vazio = usa a global KOMUNIKA_INSTANCE_ID.
  komunika_instance_id: string;
  subscription_status: string;
  billing_cycle_day: number;
  last_reset_at: string | null;
}

export interface SubscriptionInfo extends Clinic {
  usagePercent: number;
  quotaExhausted: boolean;
  nearLimit: boolean;
}

export interface ClinicAlert {
  id: number;
  clinic_id: number;
  type: string;
  message: string;
  created_at: string;
}

export interface BillingEvent {
  id: number;
  clinic_id: number;
  type: string;
  amount: number;
  currency: string;
  tokens: number;
  description: string;
  created_at: string;
}

export interface Specialty {
  id: number;
  name: string;
  description: string;
  keywords: string[];
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialty_id: number | null;
  consultation_duration: number;
  price: number;
  status: string;
  phone: string;
}

export interface DoctorSchedule {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface Appointment {
  id: number;
  patient_name: string;
  patient_phone: string;
  specialty_id: number;
  professional_id: string | null;
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
  professional_id: string;
  doctor_name: string;
  specialty_id: number;
  specialty_name: string;
  starts_at: string;
  ends_at: string;
  price: number;
}

export type NotificationType = "scheduled" | "cancelled" | "rescheduled" | "reminder" | "transfer";
export type NotificationChannelStatus = "pending" | "sent" | "failed";

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  appointment_id: number | null;
  professional_id: string | null;
  read: number;
  channel_status: NotificationChannelStatus;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  lojou_order_id: string;
  product_id: string;
  status: "active" | "inactive";
  created_at: string;
}

export interface SubscriptionRecord {
  id: string;
  clinic_id: number;
  plan_id: string;
  status: string;
  lojou_customer_id: string;
  lojou_subscription_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClinicMember {
  id: string;
  clinic_id: number;
  user_id: string;
  role: string;
  active: boolean;
  created_at: string;
}

export interface ClinicUnit {
  id: string;
  clinic_id: number;
  name: string;
  address: string;
  phone: string;
  active: boolean;
  created_at: string;
}

export interface ClinicUsage {
  id: string;
  clinic_id: number;
  period: string;
  whatsapp_conversations: number;
  ai_interactions: number;
  created_at: string;
  updated_at: string;
}
