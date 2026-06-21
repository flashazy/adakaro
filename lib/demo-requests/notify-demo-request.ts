import nodemailer from "nodemailer";
import type { DemoRequestRow } from "./types";

const DEFAULT_TO = "info@adakaro.com";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatOptional(value: string | number | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "—";
  }
  return String(value);
}

/**
 * Sends a demo-request notification to info@adakaro.com when SMTP is configured.
 * Failures are logged only — lead save must not depend on email delivery.
 */
export async function notifyDemoRequestEmail(
  request: Pick<
    DemoRequestRow,
    | "full_name"
    | "school_name"
    | "phone"
    | "email"
    | "school_type"
    | "student_count"
    | "message"
  >
): Promise<void> {
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD;
  const to = process.env.CONTACT_TO_EMAIL ?? DEFAULT_TO;

  if (!user || !pass) {
    // TODO: configure SMTP_USER + SMTP_PASS to enable demo-request email alerts.
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const textBody = [
    "New Adakaro Demo Request",
    "",
    `Full Name: ${request.full_name}`,
    `School Name: ${request.school_name}`,
    `Phone: ${request.phone}`,
    `Email: ${formatOptional(request.email)}`,
    `School Type: ${formatOptional(request.school_type)}`,
    `Number of Students: ${formatOptional(request.student_count)}`,
    "",
    "Message:",
    formatOptional(request.message),
  ].join("\n");

  const htmlBody = `
    <h2>New Adakaro Demo Request</h2>
    <p><strong>Full Name:</strong> ${escapeHtml(request.full_name)}</p>
    <p><strong>School Name:</strong> ${escapeHtml(request.school_name)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(request.phone)}</p>
    <p><strong>Email:</strong> ${escapeHtml(formatOptional(request.email))}</p>
    <p><strong>School Type:</strong> ${escapeHtml(formatOptional(request.school_type))}</p>
    <p><strong>Number of Students:</strong> ${escapeHtml(formatOptional(request.student_count))}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap;">${escapeHtml(formatOptional(request.message))}</p>
  `;

  try {
    await transporter.sendMail({
      from: `"Adakaro Leads" <info@adakaro.com>`,
      to,
      replyTo: request.email?.trim() || undefined,
      subject: "New Adakaro Demo Request",
      text: textBody,
      html: htmlBody,
    });
  } catch (err) {
    console.error("[demo-request] SMTP notification failed:", err);
  }
}
