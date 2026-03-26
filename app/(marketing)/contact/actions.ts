"use server";

import nodemailer from "nodemailer";

export interface ContactFormState {
  ok?: boolean;
  error?: string;
}

const DEFAULT_TO = "info@adakaro.com";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends contact submissions via SMTP (Gmail). Mail is delivered to CONTACT_TO_EMAIL
 * (default info@adakaro.com).
 *
 * Vercel env (sender = Gmail account used to authenticate SMTP; not hardcoded):
 * - SMTP_USER — e.g. albapesah@gmail.com (Gmail connected to info@adakaro.com)
 * - SMTP_PASS — App password for that Gmail account
 * - CONTACT_TO_EMAIL — info@adakaro.com (optional; this is the default)
 *
 * Google: Account → Security → App passwords.
 */
export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!fullName) {
    return { error: "Please enter your full name." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!subject) {
    return { error: "Please enter a subject." };
  }
  if (message.length < 10) {
    return {
      error: "Please enter a message (at least 10 characters).",
    };
  }

  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD;
  const to = process.env.CONTACT_TO_EMAIL ?? DEFAULT_TO;

  if (!user || !pass) {
    console.error(
      "[contact-form] Missing SMTP_USER or SMTP_PASS (e.g. SMTP_USER=albapesah@gmail.com + app password in Vercel)"
    );
    return {
      error:
        "We couldn’t send your message right now. Please email us directly at info@adakaro.com.",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const textBody = [
    `Contact form — Adakaro`,
    ``,
    `Full name: ${fullName}`,
    `Email (reply to this address): ${email}`,
    ``,
    `Subject: ${subject}`,
    ``,
    `Message:`,
    message,
  ].join("\n");

  const htmlBody = `
    <p><strong>Full name:</strong> ${escapeHtml(fullName)}</p>
    <p><strong>From (visitor email):</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
    <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
  `;

  try {
    await transporter.sendMail({
      from: `"Adakaro Support" <info@adakaro.com>`,
      to,
      replyTo: email,
      subject,
      text: textBody,
      html: htmlBody,
    });
  } catch (err) {
    console.error("[contact-form] SMTP send failed:", err);
    return {
      error:
        "We couldn’t send your message. Please try again or email info@adakaro.com directly.",
    };
  }

  return { ok: true };
}
