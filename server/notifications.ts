import nodemailer from "nodemailer";
import type { Appointment } from "../drizzle/schema";

export type NotificationEvent = "booked" | "cancelled";

export type NotificationStatus = {
  email: { sent: boolean; recipients: number; reason?: string };
  whatsapp: { sent: number; attempted: number; failures: string[] };
};

const GRAPH_API_VERSION = "v23.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  // The owner supplied a 10-digit Indian number in the request; normalize it for Graph API.
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return null;
}

function formatEvent(event: NotificationEvent) {
  return event === "booked" ? "Appointment confirmed" : "Appointment cancelled";
}

function formatDetails(event: NotificationEvent, appointment: Appointment) {
  const status = formatEvent(event);
  const when = `${appointment.appointmentDate} at ${appointment.appointmentTime}`;
  return `${status}\n\nName: ${appointment.fullName}\nDate and time: ${when}${appointment.phone ? `\nPhone: ${appointment.phone}` : ""}${appointment.note ? `\nNote: ${appointment.note}` : ""}\n\nManaged by Appointly.`;
}

async function sendEmail(event: NotificationEvent, appointment: Appointment): Promise<NotificationStatus["email"]> {
  const user = process.env.GMAIL_SMTP_USER;
  const password = process.env.GMAIL_SMTP_APP_PASSWORD;
  const ownerEmail = process.env.APPOINTLY_OWNER_EMAIL || user;
  const recipients = unique([appointment.email, ownerEmail]);
  if (!user || !password || !ownerEmail) {
    return { sent: false, recipients: recipients.length, reason: "Gmail SMTP is not configured. Enter the Gmail user, app password, and owner email in the connector setup." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass: password },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: ownerEmail,
      to: recipients,
      subject: `${formatEvent(event)} — ${appointment.appointmentDate} at ${appointment.appointmentTime}`,
      text: formatDetails(event, appointment),
    });
    return { sent: true, recipients: recipients.length };
  } catch (error) {
    console.warn("[Notifications] Gmail delivery failed:", error instanceof Error ? error.message : "unknown error");
    return { sent: false, recipients: recipients.length, reason: "Gmail rejected the SMTP connection or message. Verify the app password and sender address." };
  }
}

async function sendWhatsAppText(to: string, body: string) {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { ok: false, reason: "Meta WhatsApp credentials are not configured." };

  const response = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.warn(`[Notifications] WhatsApp delivery failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`);
    return { ok: false, reason: response.status === 400 ? "Meta rejected the sender, recipient, or message. Check the phone number ID and approved WhatsApp template/window." : "Meta WhatsApp delivery failed." };
  }
  return { ok: true };
}

async function sendWhatsApp(event: NotificationEvent, appointment: Appointment): Promise<NotificationStatus["whatsapp"]> {
  const configuredRecipients = unique([appointment.phone, process.env.APPOINTLY_OWNER_WHATSAPP]);
  const recipients = configuredRecipients.map(normalizeWhatsAppNumber).filter((value): value is string => Boolean(value));
  const failures: string[] = [];
  if (recipients.length === 0) {
    return { sent: 0, attempted: 0, failures: ["No E.164 WhatsApp recipient is configured. Add the owner number and enter a WhatsApp number for the booker."] };
  }

  for (const recipient of recipients) {
    try {
      const result = await sendWhatsAppText(recipient, formatDetails(event, appointment));
      if (!result.ok) failures.push(`${recipient}: ${result.reason}`);
    } catch (error) {
      failures.push(`${recipient}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  return { sent: recipients.length - failures.length, attempted: recipients.length, failures };
}

export async function dispatchAppointmentNotifications(event: NotificationEvent, appointment: Appointment): Promise<NotificationStatus> {
  const [email, whatsapp] = await Promise.all([sendEmail(event, appointment), sendWhatsApp(event, appointment)]);
  if (!email.sent || whatsapp.sent < whatsapp.attempted) {
    console.warn("[Notifications] Delivery incomplete", { event, appointmentId: appointment.id, email, whatsapp });
  }
  return { email, whatsapp };
}
