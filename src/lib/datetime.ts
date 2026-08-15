export const DAYS_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function nowStr(): string {
  return formatDateTime(new Date());
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)} ${formatTime(d)}`;
}

export function dateFromStr(dateStr: string): Date {
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function parseDatetime(datetimeStr: string): Date {
  const [datePart, timePart = "00:00"] = datetimeStr.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function addDays(dateStr: string, days: number): string {
  const d = dateFromStr(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function weekdayOf(dateStr: string): number {
  return dateFromStr(dateStr).getDay();
}

export function differenceInHours(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3600000;
}

export function displayDate(dateStr: string): string {
  const d = dateFromStr(dateStr);
  return `${DAYS_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

export function displayDateTime(datetimeStr: string): string {
  return `${displayDate(datetimeStr.split(" ")[0])} às ${datetimeStr.split(" ")[1]}`;
}
