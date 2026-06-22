"use server";

import { bootstrapNewDemoRequest } from "@/lib/demo-requests/bootstrap-lead";
import { insertPublicDemoRequest } from "@/lib/demo-requests/insert-demo-request";
import type { DemoRequestRequestType } from "@/lib/demo-requests/types";

export interface WhatsAppLeadSubmitInput {
  request_type: DemoRequestRequestType;
  full_name: string;
  school_name: string;
  phone: string;
  student_count?: number | null;
  message: string;
}

export interface WhatsAppLeadSubmitResult {
  saved: boolean;
}

function parseStudentCount(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

export async function submitWhatsAppLead(
  input: WhatsAppLeadSubmitInput
): Promise<WhatsAppLeadSubmitResult> {
  const fullName = input.full_name.trim();
  const schoolName = input.school_name.trim();
  const phone = input.phone.trim();
  const message = input.message.trim();
  const requestType = input.request_type;

  if (!fullName || !schoolName || !phone || !message) {
    return { saved: false };
  }

  if (requestType !== "demo" && requestType !== "support") {
    return { saved: false };
  }

  const studentCount =
    requestType === "demo" ? parseStudentCount(input.student_count) : null;

  const result = await insertPublicDemoRequest(
    {
      full_name: fullName,
      school_name: schoolName,
      phone,
      email: null,
      school_type: null,
      student_count: studentCount,
      message,
    },
    {
      source: "whatsapp",
      request_type: requestType,
    }
  );

  if (!result.ok) {
    console.error("[whatsapp-lead] insert failed:", result.error);
    return { saved: false };
  }

  try {
    await bootstrapNewDemoRequest({
      id: result.row.id,
      full_name: result.row.full_name,
      school_name: result.row.school_name,
      phone: result.row.phone,
      email: result.row.email,
      school_type: result.row.school_type,
      student_count: result.row.student_count,
      source: "whatsapp",
      request_type: requestType,
    });
  } catch (err) {
    console.error("[whatsapp-lead] bootstrap failed:", err);
  }

  return { saved: true };
}
