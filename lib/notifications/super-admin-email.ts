/**
 * Super admin email alerts for critical platform actions.
 *
 * Note: Supabase Auth does not expose a public API to send arbitrary HTML email
 * (Auth emails are limited to signup, recovery, invite, etc.). This module uses
 * SMTP via nodemailer — configure the same provider you use in the Supabase
 * dashboard (Custom SMTP) or any transactional provider (Resend, SendGrid, etc.).
 *
 * Env:
 * - SUPER_ADMIN_EMAIL_NOTIFICATIONS_ENABLED — set to "false" to disable (default: on)
 * - SUPER_ADMIN_NOTIFY_EXTRA_EMAILS — optional comma-separated addresses
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (or EMAIL_FROM)
 */

import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlanId, PLANS, type PlanId } from "@/lib/plans";
import type { Database } from "@/types/supabase";

function notificationsEnabled(): boolean {
  return process.env.SUPER_ADMIN_EMAIL_NOTIFICATIONS_ENABLED !== "false";
}

function getAppBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) {
    const host = v.replace(/^https?:\/\//, "");
    return host.startsWith("localhost") ? `http://${host}` : `https://${host}`;
  }
  return "http://localhost:3000";
}

export function superAdminSchoolUrl(schoolId: string): string {
  return `${getAppBaseUrl()}/super-admin/schools/${schoolId}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function planLabel(plan: string | null | undefined): string {
  const id = normalizePlanId(plan);
  return PLANS[id]?.name ?? id;
}

export function isPaidPlan(plan: string | null | undefined): boolean {
  return normalizePlanId(plan) !== "free";
}

/**
 * Recipients: profiles.role = super_admin with non-null email, plus
 * SUPER_ADMIN_NOTIFY_EXTRA_EMAILS (comma-separated).
 */
export async function fetchSuperAdminNotificationEmails(
  admin?: SupabaseClient<Database>
): Promise<string[]> {
  const client = admin ?? createAdminClient();
  const { data, error } = await client
    .from("profiles")
    .select("email")
    .eq("role", "super_admin")
    .not("email", "is", null);

  if (error) {
    console.error("[super-admin-email] fetch super admins:", error.message);
    return [];
  }

  const set = new Set<string>();
  for (const row of (data ?? []) as { email: string | null }[]) {
    const e = row.email?.trim().toLowerCase();
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) set.add(e);
  }

  const extra = process.env.SUPER_ADMIN_NOTIFY_EXTRA_EMAILS?.trim();
  if (extra) {
    for (const part of extra.split(",")) {
      const e = part.trim().toLowerCase();
      if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) set.add(e);
    }
  }

  return [...set];
}

export interface SendSuperAdminEmailParams {
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends one email per recipient (BCC could be used; separate sends avoid
 * exposing addresses to each other). Failures are logged but never thrown.
 */
export async function sendSuperAdminNotification(
  params: SendSuperAdminEmailParams
): Promise<void> {
  if (!notificationsEnabled()) return;

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim();

  if (!host || !from) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[super-admin-email] SMTP not configured (SMTP_HOST / SMTP_FROM); skipping send."
      );
    }
    return;
  }

  let recipients: string[];
  try {
    recipients = await fetchSuperAdminNotificationEmails();
  } catch (e) {
    console.error("[super-admin-email] recipients:", e);
    return;
  }

  if (recipients.length === 0) {
    console.warn("[super-admin-email] No super admin email addresses found.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure: port === 465,
      auth:
        user && pass
          ? {
              user,
              pass,
            }
          : undefined,
    });

    for (const to of recipients) {
      await transporter.sendMail({
        from,
        to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
    }
  } catch (e) {
    console.error(
      "[super-admin-email] send failed:",
      e instanceof Error ? e.message : e
    );
  }
}

function footerBlock(): string {
  const base = getAppBaseUrl();
  return `
<p style="margin-top:24px;font-size:12px;color:#64748b;">
  This is an automated notification from Adakaro.<br />
  To change notification preferences, use your platform settings or ask your administrator to update environment configuration
  (<code>SUPER_ADMIN_EMAIL_NOTIFICATIONS_ENABLED</code>).
</p>
<p style="font-size:12px;color:#64748b;">
  <a href="${base}">${base}</a>
</p>`;
}

export async function notifySchoolSuspended(params: {
  schoolId: string;
  schoolName: string;
  performedByEmail: string;
  reason: string | null;
}): Promise<void> {
  const when = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "medium",
  });
  const reasonText = params.reason?.trim() || "(none provided)";
  const url = superAdminSchoolUrl(params.schoolId);
  const subject = `⚠️ School Suspended: ${params.schoolName}`;
  const html = `
<p>Hello Super Admin,</p>
<p><strong>Action:</strong> School suspension</p>
<p><strong>School:</strong> ${escapeHtml(params.schoolName)} (${escapeHtml(params.schoolId)})</p>
<p><strong>Performed by:</strong> ${escapeHtml(params.performedByEmail)}</p>
<p><strong>Time:</strong> ${escapeHtml(when)}</p>
<p><strong>Reason:</strong> ${escapeHtml(reasonText)}</p>
<p><a href="${url}">View school in admin</a></p>
${footerBlock()}`;
  const text = [
    "Hello Super Admin,",
    "",
    "Action: School suspension",
    `School: ${params.schoolName} (ID: ${params.schoolId})`,
    `Performed by: ${params.performedByEmail}`,
    `Time: ${when}`,
    `Reason: ${reasonText}`,
    "",
    `View school: ${url}`,
    "",
    "This is an automated notification from Adakaro.",
  ].join("\n");

  await sendSuperAdminNotification({ subject, html, text });
}

export async function notifySchoolActivated(params: {
  schoolId: string;
  schoolName: string;
  performedByEmail: string;
}): Promise<void> {
  const when = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "medium",
  });
  const url = superAdminSchoolUrl(params.schoolId);
  const subject = `✅ School Activated: ${params.schoolName}`;
  const html = `
<p>Hello Super Admin,</p>
<p><strong>Action:</strong> School activation</p>
<p><strong>School:</strong> ${escapeHtml(params.schoolName)} (${escapeHtml(params.schoolId)})</p>
<p><strong>Performed by:</strong> ${escapeHtml(params.performedByEmail)}</p>
<p><strong>Time:</strong> ${escapeHtml(when)}</p>
<p><a href="${url}">View school in admin</a></p>
${footerBlock()}`;
  const text = [
    "Hello Super Admin,",
    "",
    "Action: School activation",
    `School: ${params.schoolName} (ID: ${params.schoolId})`,
    `Performed by: ${params.performedByEmail}`,
    `Time: ${when}`,
    "",
    `View school: ${url}`,
    "",
    "This is an automated notification from Adakaro.",
  ].join("\n");

  await sendSuperAdminNotification({ subject, html, text });
}

export async function notifyPlanChange(params: {
  schoolId: string;
  schoolName: string;
  performedByEmail: string;
  oldPlan: string | null;
  newPlan: PlanId;
}): Promise<void> {
  const when = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "medium",
  });
  const url = superAdminSchoolUrl(params.schoolId);
  const oldL = planLabel(params.oldPlan);
  const newL = planLabel(params.newPlan);
  const subject = `💰 Plan Change: ${params.schoolName} → ${newL}`;
  const html = `
<p>Hello Super Admin,</p>
<p><strong>Action:</strong> Plan change</p>
<p><strong>School:</strong> ${escapeHtml(params.schoolName)} (${escapeHtml(params.schoolId)})</p>
<p><strong>Performed by:</strong> ${escapeHtml(params.performedByEmail)}</p>
<p><strong>Time:</strong> ${escapeHtml(when)}</p>
<p><strong>Plan:</strong> ${escapeHtml(oldL)} → ${escapeHtml(newL)}</p>
<p><a href="${url}">View school in admin</a></p>
${footerBlock()}`;
  const text = [
    "Hello Super Admin,",
    "",
    "Action: Plan change",
    `School: ${params.schoolName} (ID: ${params.schoolId})`,
    `Performed by: ${params.performedByEmail}`,
    `Time: ${when}`,
    `Plan: ${oldL} → ${newL}`,
    "",
    `View school: ${url}`,
    "",
    "This is an automated notification from Adakaro.",
  ].join("\n");

  await sendSuperAdminNotification({ subject, html, text });
}

export async function notifyPlanDowngradeToFree(params: {
  schoolId: string;
  schoolName: string;
  performedByEmail: string;
  oldPlan: string | null;
}): Promise<void> {
  const when = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "medium",
  });
  const url = superAdminSchoolUrl(params.schoolId);
  const oldL = planLabel(params.oldPlan);
  const subject = `⚠️ IMPORTANT: ${params.schoolName} Downgraded`;
  const html = `
<p>Hello Super Admin,</p>
<p><strong>Action:</strong> Plan downgrade to Free</p>
<p><strong>School:</strong> ${escapeHtml(params.schoolName)} (${escapeHtml(params.schoolId)})</p>
<p><strong>Performed by:</strong> ${escapeHtml(params.performedByEmail)}</p>
<p><strong>Time:</strong> ${escapeHtml(when)}</p>
<p><strong>Previous plan:</strong> ${escapeHtml(oldL)} → <strong>Free</strong></p>
<p><a href="${url}">View school in admin</a></p>
${footerBlock()}`;
  const text = [
    "Hello Super Admin,",
    "",
    "IMPORTANT: Plan downgrade to Free",
    `School: ${params.schoolName} (ID: ${params.schoolId})`,
    `Performed by: ${params.performedByEmail}`,
    `Time: ${when}`,
    `Previous plan: ${oldL} → Free`,
    "",
    `View school: ${url}`,
    "",
    "This is an automated notification from Adakaro.",
  ].join("\n");

  await sendSuperAdminNotification({ subject, html, text });
}

export async function notifyNewSchoolCreated(params: {
  schoolId: string;
  schoolName: string;
  performedByEmail: string;
  currency: string;
  plan: PlanId;
}): Promise<void> {
  const when = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "medium",
  });
  const url = superAdminSchoolUrl(params.schoolId);
  const planName = planLabel(params.plan);
  const subject = `🏫 New School Created: ${params.schoolName}`;
  const html = `
<p>Hello Super Admin,</p>
<p><strong>Action:</strong> New school created</p>
<p><strong>School:</strong> ${escapeHtml(params.schoolName)} (${escapeHtml(params.schoolId)})</p>
<p><strong>Performed by:</strong> ${escapeHtml(params.performedByEmail)}</p>
<p><strong>Time:</strong> ${escapeHtml(when)}</p>
<p><strong>Currency:</strong> ${escapeHtml(params.currency)}</p>
<p><strong>Plan:</strong> ${escapeHtml(planName)}</p>
<p><a href="${url}">View school in admin</a></p>
${footerBlock()}`;
  const text = [
    "Hello Super Admin,",
    "",
    "Action: New school created",
    `School: ${params.schoolName} (ID: ${params.schoolId})`,
    `Performed by: ${params.performedByEmail}`,
    `Time: ${when}`,
    `Currency: ${params.currency}`,
    `Plan: ${planName}`,
    "",
    `View school: ${url}`,
    "",
    "This is an automated notification from Adakaro.",
  ].join("\n");

  await sendSuperAdminNotification({ subject, html, text });
}

/** Sends downgrade email OR generic plan-change email (not both). */
export async function notifyPlanChangeIfNeeded(params: {
  schoolId: string;
  schoolName: string;
  performedByEmail: string;
  oldPlan: string | null;
  newPlan: string;
}): Promise<void> {
  const newP = normalizePlanId(params.newPlan);
  const oldP = normalizePlanId(params.oldPlan ?? "free");
  if (oldP === newP) return;

  if (isPaidPlan(oldP) && newP === "free") {
    await notifyPlanDowngradeToFree({
      schoolId: params.schoolId,
      schoolName: params.schoolName,
      performedByEmail: params.performedByEmail,
      oldPlan: params.oldPlan,
    });
    return;
  }

  await notifyPlanChange({
    schoolId: params.schoolId,
    schoolName: params.schoolName,
    performedByEmail: params.performedByEmail,
    oldPlan: params.oldPlan,
    newPlan: newP,
  });
}
