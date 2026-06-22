import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DemoRequestLeadSource,
  DemoRequestRequestType,
} from "@/lib/demo-requests/types";

export interface DemoRequestInsertInput {
  full_name: string;
  school_name: string;
  phone: string;
  email: string | null;
  school_type: string | null;
  student_count: number | null;
  message: string | null;
}

export interface InsertDemoRequestOptions {
  source?: DemoRequestLeadSource;
  request_type?: DemoRequestRequestType;
}

export type InsertedDemoRequest = DemoRequestInsertInput & {
  id: string;
  source: DemoRequestLeadSource;
  request_type: DemoRequestRequestType;
};

const INSERT_SELECT =
  "id, full_name, school_name, phone, email, school_type, student_count, message, source, request_type";

function logInsertError(
  channel: string,
  error: { message: string; code?: string; details?: string; hint?: string }
): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[demo-requests] ${channel} insert error:`, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return;
  }
  console.error(
    `[demo-requests] demo_requests insert failed (${channel}):`,
    error.message
  );
}

/**
 * Inserts a public lead from the marketing Contact page or WhatsApp modal.
 *
 * Uses the service role on the server so INSERT … RETURNING works without
 * granting public SELECT on demo_requests. Falls back to anon INSERT without
 * RETURNING when the service role key is unavailable.
 */
export async function insertPublicDemoRequest(
  input: DemoRequestInsertInput,
  options: InsertDemoRequestOptions = {}
): Promise<
  | { ok: true; row: InsertedDemoRequest }
  | { ok: false; error: string; code?: string }
> {
  const source = options.source ?? "contact_page";
  const request_type = options.request_type ?? "demo";

  const payload = {
    full_name: input.full_name,
    school_name: input.school_name,
    phone: input.phone,
    email: input.email,
    school_type: input.school_type,
    student_count: input.student_count,
    message: input.message,
    status: "New" as const,
    source,
    request_type,
  };

  if (process.env.NODE_ENV === "development") {
    console.info("[demo-requests] submitting lead:", {
      source,
      request_type,
      school_name: payload.school_name,
      full_name: payload.full_name,
      phone: `${payload.phone.slice(0, 4)}***`,
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

    return { ok: true, row: data as InsertedDemoRequest };
  } catch (adminErr) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[demo-requests] service role unavailable, using anon insert fallback:",
        adminErr
      );
    }
  }

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

  return {
    ok: true,
    row: { id, ...input, source, request_type },
  };
}
