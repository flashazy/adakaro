"use server";

import { bootstrapNewDemoRequest } from "@/lib/demo-requests/bootstrap-lead";
import { insertPublicDemoRequest } from "@/lib/demo-requests/insert-demo-request";
import { notifyDemoRequestEmail } from "@/lib/demo-requests/notify-demo-request";
import {
  DEMO_REQUEST_SCHOOL_TYPES,
  type DemoRequestSchoolType,
} from "@/lib/demo-requests/types";

export interface ContactFormState {
  ok?: boolean;
  error?: string;
}

function normalizeOptionalText(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return value === "" ? null : value;
}

function parseStudentCount(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function publicInsertErrorMessage(code?: string): string {
  if (process.env.NODE_ENV === "development") {
    if (code === "42P01" || code === "PGRST205") {
      return "Demo requests table is missing. Apply Supabase migration 00179_demo_requests.sql.";
    }
    if (code === "42501") {
      return "Permission denied inserting demo request. Check demo_requests RLS policies.";
    }
  }
  return "We could not save your request right now. Please try again or contact us on WhatsApp.";
}

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = normalizeOptionalText(formData.get("email"));
  const schoolTypeRaw = String(formData.get("schoolType") ?? "").trim();
  const message = normalizeOptionalText(formData.get("message"));
  const studentCount = parseStudentCount(formData.get("studentCount"));

  if (!fullName) {
    return { error: "Please enter your full name." };
  }
  if (!schoolName) {
    return { error: "Please enter your school name." };
  }
  if (!phone) {
    return { error: "Please enter a phone or WhatsApp number." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  let schoolType: DemoRequestSchoolType | null = null;
  if (schoolTypeRaw) {
    if (
      !DEMO_REQUEST_SCHOOL_TYPES.includes(
        schoolTypeRaw as DemoRequestSchoolType
      )
    ) {
      return { error: "Please choose a valid school type." };
    }
    schoolType = schoolTypeRaw as DemoRequestSchoolType;
  }

  if (
    formData.get("studentCount") &&
    String(formData.get("studentCount")).trim() &&
    studentCount === null
  ) {
    return { error: "Number of students must be a valid whole number." };
  }

  const result = await insertPublicDemoRequest({
    full_name: fullName,
    school_name: schoolName,
    phone,
    email,
    school_type: schoolType,
    student_count: studentCount,
    message,
  });

  if (!result.ok) {
    return { error: publicInsertErrorMessage(result.code) };
  }

  const lead = result.row;

  try {
    await Promise.all([
      notifyDemoRequestEmail(lead),
      bootstrapNewDemoRequest(lead),
    ]);
  } catch (err) {
    console.error("[contact-form] post-insert notifications failed:", err);
  }

  return { ok: true };
}
