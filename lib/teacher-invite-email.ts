import "server-only";

import nodemailer from "nodemailer";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendTeacherInvitationEmail(params: {
  to: string;
  inviteUrl: string;
  schoolName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD;
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    (user ? `"Adakaro" <${user}>` : null);

  if (!user || !pass || !from) {
    console.error(
      "[teacher-invite] Missing SMTP (SMTP_USER, SMTP_PASS) or sender (EMAIL_FROM / SMTP_FROM)."
    );
    return {
      ok: false,
      error:
        "Email could not be sent (SMTP not configured). Ask your administrator to set SMTP in the server environment.",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const subject = `You’re invited to teach on Adakaro — ${params.schoolName}`;
  const html = `
    <p>Hello,</p>
    <p>You’ve been invited to join <strong>${escapeHtml(params.schoolName)}</strong> on Adakaro as a teacher.</p>
    <p><a href="${escapeHtml(params.inviteUrl)}">Create your password and accept the invitation</a></p>
    <p style="color:#64748b;font-size:12px;">If the button doesn’t work, copy this link:<br/>${escapeHtml(params.inviteUrl)}</p>
    <p>— Adakaro</p>
  `;

  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject,
      text: `You’re invited to teach at ${params.schoolName} on Adakaro.\n\nOpen this link to create your password:\n${params.inviteUrl}\n`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[teacher-invite] SMTP send failed:", err);
    return {
      ok: false,
      error: "Could not send the invitation email. Try again or contact support.",
    };
  }
}
