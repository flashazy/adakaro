export const ADAKARO_WHATSAPP_NUMBER = "255762545454";
export const ADAKARO_WHATSAPP_DISPLAY = "+255 762 545 454";

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${ADAKARO_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export interface DemoWhatsAppPayload {
  fullName: string;
  schoolName: string;
  phone: string;
  email?: string;
  studentCount: string;
  message: string;
}

export interface SupportWhatsAppPayload {
  fullName: string;
  schoolName: string;
  phone: string;
  email?: string;
  issue: string;
}

export function buildDemoWhatsAppMessage(payload: DemoWhatsAppPayload): string {
  const lines = [
    "Hello Adakaro,",
    "",
    "I would like to request a demo.",
    "",
    `Name: ${payload.fullName.trim()}`,
    `School: ${payload.schoolName.trim()}`,
    `Phone: ${payload.phone.trim()}`,
  ];

  if (payload.email?.trim()) {
    lines.push(`Email: ${payload.email.trim()}`);
  }

  if (payload.studentCount.trim()) {
    lines.push(`Students: ${payload.studentCount.trim()}`);
  }

  lines.push(
    "",
    "Interested in:",
    payload.message.trim(),
    "",
    "Thank you."
  );

  return lines.join("\n");
}

export function buildSupportWhatsAppMessage(
  payload: SupportWhatsAppPayload
): string {
  const lines = [
    "Hello Adakaro,",
    "",
    "I need support.",
    "",
    `Name: ${payload.fullName.trim()}`,
    `School: ${payload.schoolName.trim()}`,
    `Phone: ${payload.phone.trim()}`,
    `Email: ${payload.email?.trim() || "—"}`,
    "",
    "Issue:",
    payload.issue.trim(),
    "",
    "Thank you.",
  ];

  return lines.join("\n");
}

export function openWhatsAppChat(message: string): boolean {
  const url = buildWhatsAppUrl(message);
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  return popup != null;
}
