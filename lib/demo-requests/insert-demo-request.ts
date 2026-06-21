import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DemoRequestInsertInput {
  full_name: string;
  school_name: string;
  phone: string;
  email: string | null;
  school_type: string | null;
  student_count: number | null;
  message: string | null;
}

export type InsertedDemoRequest = DemoRequestInsertInput & { id: string };

const INSERT_SELECT =
  "id, full_name, school_name, phone, email, school_type, student_count, message";

function logInsertError(
  channel: string,
  error: { message: string; code?: string; details?: string; hint?: string }
): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[contact-form] ${channel} insert error:`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return;
  }
  console.error(
    `[contact-form] demo_requests insert failed (${channel}):`,
    error.message
  );
}

/**
 * Inserts a public demo request from the marketing Contact form.
 *
 * Uses the service role on the server so INSERT … RETURNING works without
 * granting public SELECT on demo_requests. Falls back to anon INSERT without
 * RETURNING when the service role key is unavailable.
 */
export async function insertPublicDemoRequest(
  input: DemoRequestInsertInput
): Promise<
  | { ok: true; row: InsertedDemoRequest }
  | { ok: false; error: string; code?: string }
> {
  const payload = {
    full_name: input.full_name,
    school_name: input.school_name,
    phone: input.phone,
    email: input.email,
    school_type: input.school_type,
    student_count: input.student_count,
    message: input.message,
    status: "New" as const,
    source: "contact_page" as const,
  };

  if (process.env.NODE_ENV === "development") {
    console.info("[contact-form] submitting demo request:", {
      school_name: payload.school_name,
      full_name: payload.full_name,
      phone: `${payload.phone.slice(0, 4)}***`,
      email: payload.email ? `${payload.email.slice(0, 3)}***` : null,
      school_type: payload.school_type,
      student_count: payload.student_count,
      has_message: Boolean(payload.message?.trim()),
    });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("demo_requests")
      .insert(payload as never)
      .select(INSERT_SELECT)
      .single();

    if (error) {
      logInsertError("service_role", error);
      return { ok: false, error: error.message, code: error.code };
    }
    if (!data) {
      return { ok: false, error: "Insert returned no row." };
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[contact-form] demo request saved:", {
        id: (data as InsertedDemoRequest).id,
      });
    }

    return { ok: true, row: data as InsertedDemoRequest };
  } catch (adminErr) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[contact-form] service role unavailable, using anon insert fallback:",
        adminErr
      );
    }
  }

  // Anon/authenticated clients may INSERT but cannot SELECT (RLS). Do not use
  // .select() here — RETURNING would be blocked by SELECT policies.
  const supabase = await createClient();
  const id = randomUUID();
  const { error } = await supabase.from("demo_requests").insert({
    id,
    ...payload,
  } as never);

  if (error) {
    logInsertError("anon", error);
    return { ok: false, error: error.message, code: error.code };
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[contact-form] demo request saved (anon fallback):", { id });
  }

  return { ok: true, row: { id, ...input } };
}
