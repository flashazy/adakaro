import type { DemoRequestRow } from "@/lib/demo-requests/types";

function randomSegment(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

export function generateGoogleMeetLink(): string {
  return `https://meet.google.com/${randomSegment(3)}-${randomSegment(4)}-${randomSegment(3)}`;
}

export function generateZoomMeetingLink(): string {
  return `https://zoom.us/j/${randomDigits(10)}`;
}

export function buildDemoInvitation(row: Pick<
  DemoRequestRow,
  "full_name" | "demo_date" | "demo_time" | "meeting_link" | "email"
>): { subject: string; body: string; mailto: string } {
  const dateLabel = row.demo_date
    ? new Date(row.demo_date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "TBC";
  const timeLabel = row.demo_time?.slice(0, 5) ?? "TBC";
  const link = row.meeting_link?.trim() || "Will be shared before the session";

  const subject = "Adakaro Demo Invitation";
  const body = `Hello ${row.full_name},

Thank you for your interest in Adakaro.

Your demo has been scheduled for:

Date: ${dateLabel}
Time: ${timeLabel}

Meeting Link:
${link}

We look forward to showing you how Adakaro can help your school manage students, attendance, report cards, finance, and operations.

Regards,
Adakaro Team`;

  const recipient = row.email?.trim() ? row.email.trim() : "";
  const mailto = recipient
    ? `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { subject, body, mailto };
}
