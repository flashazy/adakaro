import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderStudentsByGenderThenName } from "@/lib/student-list-order";
import type { Database } from "@/types/supabase";
import {
  SchoolDetailClient,
  type InvitationRow,
  type MemberRow,
  type SchoolDetail,
  type StudentRow,
} from "./school-detail-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminSchoolDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    redirect("/dashboard");
  }

  type SchoolPick = Pick<
    Database["public"]["Tables"]["schools"]["Row"],
    | "id"
    | "name"
    | "plan"
    | "currency"
    | "status"
    | "suspension_reason"
    | "created_at"
    | "created_by"
  >;

  /** Prefer full row (includes suspension fields after migration 00041). */
  async function loadSchoolRow(
    client: SupabaseClient<Database>
  ): Promise<SchoolPick | null> {
    const full = await client
      .from("schools")
      .select(
        "id, name, plan, currency, status, suspension_reason, created_at, created_by"
      )
      .eq("id", id)
      .maybeSingle();
    if (!full.error && full.data) {
      return full.data as SchoolPick;
    }
    const base = await client
      .from("schools")
      .select("id, name, plan, currency, created_at, created_by")
      .eq("id", id)
      .maybeSingle();
    if (base.error || !base.data) {
      return null;
    }
    return {
      ...(base.data as Pick<
        SchoolPick,
        "id" | "name" | "plan" | "currency" | "created_at" | "created_by"
      >),
      status: "active",
      suspension_reason: null,
    } as SchoolPick;
  }

  let queryClient = supabase;
  let school = await loadSchoolRow(supabase);

  if (!school) {
    try {
      const admin = createAdminClient();
      const loaded = await loadSchoolRow(admin);
      if (loaded) {
        school = loaded;
        queryClient = admin;
      }
    } catch {
      /* service role not configured */
    }
  }

  if (!school) {
    notFound();
  }

  const { data: membersRaw } = await queryClient
    .from("school_members")
    .select(
      `
      user_id,
      role,
      profiles ( full_name, email )
    `
    )
    .eq("school_id", id);

  const members: MemberRow[] = (membersRaw ?? []).map((row) => {
    const r = row as {
      user_id: string;
      role: string;
      profiles: { full_name: string; email: string | null } | null;
    };
    return {
      user_id: r.user_id,
      role: r.role,
      full_name: r.profiles?.full_name ?? "—",
      email: r.profiles?.email ?? null,
    };
  });

  const { data: studentsRaw } = await orderStudentsByGenderThenName(
    queryClient
      .from("students")
      .select("id, full_name, admission_number, status")
      .eq("school_id", id)
  ).limit(200);

  const { count: studentCount } = await queryClient
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("school_id", id);

  const { data: invRaw } = await queryClient
    .from("school_invitations")
    .select("id, invited_email, status, created_at, expires_at")
    .eq("school_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const schoolDetail: SchoolDetail = {
    id: school.id,
    name: school.name,
    plan: school.plan,
    currency: school.currency,
    status: school.status ?? "active",
    suspension_reason: school.suspension_reason ?? null,
    created_at: school.created_at,
    created_by: school.created_by,
  };

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500 dark:text-zinc-400">
          Loading school…
        </div>
      }
    >
      <SchoolDetailClient
        school={schoolDetail}
        members={members}
        students={(studentsRaw ?? []) as StudentRow[]}
        studentCount={studentCount ?? 0}
        invitations={(invRaw ?? []) as InvitationRow[]}
      />
    </Suspense>
  );
}
