import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin-activity-log";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { generateAdmissionNumberWithClient } from "@/lib/admission-number";
import { checkStudentLimit } from "@/lib/plan-limits";
import type { Database } from "@/types/supabase";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const schoolId = await getSchoolIdForUser(supabase, user.id);
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school found.", upgradeUrl: "/pricing" },
        { status: 400 }
      );
    }

    const { data: isAdmin, error: adminErr } = await supabase.rpc(
      "is_school_admin",
      { p_school_id: schoolId } as never
    );
    if (adminErr || !isAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    let body: {
      full_name?: string;
      class_id?: string;
      admission_number?: string | null;
      gender?: string;
      parent_name?: string | null;
      parent_email?: string | null;
      parent_phone?: string | null;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const fullName = String(body.full_name ?? "").trim();
    const classId = String(body.class_id ?? "").trim();
    let admissionNumber =
      body.admission_number != null && String(body.admission_number).trim() !== ""
        ? String(body.admission_number).trim()
        : null;
    const parentName =
      body.parent_name != null && String(body.parent_name).trim() !== ""
        ? String(body.parent_name).trim()
        : null;
    const parentEmail =
      body.parent_email != null && String(body.parent_email).trim() !== ""
        ? String(body.parent_email).trim()
        : null;
    const parentPhone =
      body.parent_phone != null && String(body.parent_phone).trim() !== ""
        ? String(body.parent_phone).trim()
        : null;
    const genderRaw =
      body.gender != null ? String(body.gender).trim().toLowerCase() : "";
    const gender =
      genderRaw === "male" || genderRaw === "female" ? genderRaw : "male";

    if (!fullName) {
      return NextResponse.json(
        { error: "Student name is required." },
        { status: 400 }
      );
    }
    if (!classId) {
      return NextResponse.json(
        { error: "Please select a class." },
        { status: 400 }
      );
    }

    if (!admissionNumber) {
      const { data: sch, error: schErr } = await supabase
        .from("schools")
        .select("admission_prefix")
        .eq("id", schoolId)
        .maybeSingle();

      if (schErr) {
        return NextResponse.json({ error: schErr.message }, { status: 500 });
      }

      const prefix = (
        sch as { admission_prefix: string | null } | null
      )?.admission_prefix?.trim();

      if (!prefix) {
        return NextResponse.json(
          {
            error:
              "Provide an admission_number or set a school admission prefix for auto-generated numbers.",
          },
          { status: 400 }
        );
      }

      try {
        admissionNumber = await generateAdmissionNumberWithClient(
          supabase,
          schoolId
        );
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not generate admission number.";
        return NextResponse.json({ error: message }, { status: 422 });
      }
    }

    const limitCheck = await checkStudentLimit(supabase, schoolId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error:
            "You've reached your plan limit. Upgrade to add more students.",
          upgradeUrl: "/pricing",
          code: "student_limit",
          current: limitCheck.current,
          limit: limitCheck.limit,
        },
        { status: 403 }
      );
    }

    const row: Database["public"]["Tables"]["students"]["Insert"] = {
      school_id: schoolId,
      class_id: classId,
      full_name: fullName,
      admission_number: admissionNumber,
      gender,
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: parentPhone,
    };

    const { error: insErr } = await supabase.from("students").insert(row as never);

    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json(
          {
            error: "This admission number is already in use for another student.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    revalidatePath("/dashboard/students");

    void logAdminAction({
      userId: user.id,
      action: "create_student",
      schoolId,
      details: { class_id: classId, admission_number: admissionNumber ?? undefined },
      request,
    });

    return NextResponse.json({
      ok: true,
      message: `Student "${fullName}" added.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
