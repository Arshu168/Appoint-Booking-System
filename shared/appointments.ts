export const TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];
export type AppointmentStatus = "booked" | "cancelled";

export type AppointmentRecord = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  note: string | null;
  appointmentDate: string;
  appointmentTime: string;
  visitorKey?: string | null;
  status: AppointmentStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
  cancelledAt: string | Date | null;
};

export function getLocalToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function formatSlot(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}
