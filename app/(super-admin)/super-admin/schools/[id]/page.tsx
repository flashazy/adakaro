import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const { data: schoolRow, error: schoolErr } = await supabase
    .from("schools")
    .select("id, name, plan, currency, created_at, created_by")
    .eq("id", id)
    .maybeSingle();

  type SchoolPick = Pick<
    Database["public"]["Tables"]["schools"]["Row"],
    "id" | "name" | "plan" | "currency" | "created_at" | "created_by"
  >;

  let queryClient = supabase;
  let school: SchoolPick | null = schoolRow as SchoolPick | null;

  if (schoolErr || !school) {
    try {
      const admin = createAdminClient();
      const { data: adminSchool, error: adminErr } = await admin
        .from("schools")
        .select("id, name, plan, currency, created_at, created_by")
        .eq("id", id)
        .maybeSingle();
      if (!adminErr && adminSchool) {
        school = adminSchool as SchoolPick;
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

  const { data: studentsRaw } = await queryClient
    .from("students")
    .select("id, full_name, admission_number, status")
    .eq("school_id", id)
    .order("full_name")
    .limit(200);

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
