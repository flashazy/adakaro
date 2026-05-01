import { BackButton } from "@/components/dashboard/back-button";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { normalizeSchoolCurrency } from "@/lib/currency";
import { resolveSchoolDisplayTimezone } from "@/lib/school-timezone";
import {
  loadProfileAttendanceSummary,
  loadProfileFeeBalances,
  loadProfileGradebookScores,
  loadProfileFinanceNotes,
  loadProfileReportCards,
} from "@/lib/student-profile-auto-data";
import {
  loadProfilePaymentHistoryPage,
  parseProfilePaymentListQuery,
  profilePaymentListUrlIsActive,
  serializeProfilePaymentListQuery,
  type ProfilePaymentListQuery,
} from "@/lib/student-profile-payments-list";
import { normalizeSchoolLevel } from "@/lib/school-level";
import { formatPaymentRecorderLine } from "@/lib/payment-recorder-label";
import { StudentProfileClient } from "./student-profile-client";
import type {
  StudentProfileTabId,
  StudentProfileViewerFlags,
} from "./student-profile-viewer";
import type { Database, UserRole } from "@/types/supabase";

export const dynamic = "force-dynamic";

type AcademicRow =
  Database["public"]["Tables"]["student_academic_records"]["Row"];
type DisciplineRow =
  Database["public"]["Tables"]["student_discipline_records"]["Row"];
type HealthRow = Database["public"]["Tables"]["student_health_records"]["Row"];
type AttachmentRow =
  Database["public"]["Tables"]["student_record_attachments"]["Row"];

export type { StudentProfileTabId, StudentProfileViewerFlags };

function searchParamsToURLSearchParams(
  raw: Readonly<Record<string, string | string[] | undefined>>
): URLSearchParams {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) p.append(key, v);
    } else {
      p.set(key, value);
    }
  }
  return p;
}

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const { studentId } = await params;
  const rawSearchParams = await searchParams;
  const urlSearch = searchParamsToURLSearchParams(
    (rawSearchParams ?? {}) as Readonly<Record<string, string | string[] | undefined>>
  );
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select(
      "id, full_name, admission_number, school_id, avatar_url, class_id, class:classes(name)"
    )
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (studentError || !student) {
    notFound();
  }

  const typedStudent = student as {
    id: string;
    full_name: string;
    admission_number: string | null;
    school_id: string;
    avatar_url: string | null;
    class_id: string;
    class: { name: string } | null;
  };

  const [
    { data: isAdmin },
    { data: isSuper },
    { data: teacherForClass },
    { data: scopeRows, error: scopeErr },
    { data: deptRoleRows, error: deptRoleErr },
    { data: myProfile, error: myProfileErr },
  ] = await Promise.all([
    supabase.rpc("is_school_admin", { p_school_id: schoolId } as never),
    supabase.rpc("is_super_admin" as never),
    supabase.rpc("is_teacher_for_class", {
      p_class_id: typedStudent.class_id,
    } as never),
    supabase
      .from("school_member_record_attachment_scopes")
      .select("scope")
      .eq("school_id", schoolId)
      .eq("user_id", user.id),
    supabase
      .from("teacher_department_roles")
      .select("department")
      .eq("school_id", schoolId)
      .eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const hasHealthScope =
    !scopeErr &&
    (scopeRows ?? []).some((r) => (r as { scope: string }).scope === "health");
  const hasDisciplineScope =
    !scopeErr &&
    (scopeRows ?? []).some((r) => (r as { scope: string }).scope === "discipline");

  const departmentRoles = new Set<StudentProfileTabId>();
  if (!deptRoleErr) {
    for (const row of deptRoleRows ?? []) {
      const dep = (row as { department: string }).department;
      if (dep === "academic" || dep === "discipline" || dep === "health") {
        departmentRoles.add(dep);
      } else if (dep === "finance" || dep === "accounts") {
        departmentRoles.add("finance");
      }
    }
  }

  const me = myProfile as { full_name: string | null; role: UserRole } | null;
  const myProfileRole = me?.role;
  const isFinanceOrAccountsProfile =
    myProfileRole === "finance" || myProfileRole === "accounts";
  const currentUserFinanceNoteRecorderLine = formatPaymentRecorderLine(
    me?.full_name ?? null,
    me?.role ?? null
  );

  const adminOk = Boolean(isAdmin) || Boolean(isSuper);
  const teacherOk = Boolean(teacherForClass);
  const canAccessProfile =
    adminOk ||
    teacherOk ||
    departmentRoles.size > 0 ||
    hasHealthScope ||
    hasDisciplineScope ||
    isFinanceOrAccountsProfile;

  if (!canAccessProfile) {
    redirect("/dashboard/students");
  }

  const allTabs: StudentProfileTabId[] = [
    "academic",
    "discipline",
    "health",
    "finance",
  ];

  const tabAccess = new Set<StudentProfileTabId>(departmentRoles);
  if (isFinanceOrAccountsProfile) {
    tabAccess.add("finance");
  }

  let visibleTabs: StudentProfileTabId[];
  if (adminOk) {
    visibleTabs = allTabs;
  } else {
    // Tabs: teacher_department_roles plus optional profiles.role = finance/accounts
    // (see tabAccess). Legacy attachment scopes do not grant tab visibility.
    visibleTabs = allTabs.filter((t) => tabAccess.has(t));
  }

  const canRecordPayment =
    adminOk ||
    isFinanceOrAccountsProfile ||
    tabAccess.has("finance");

  const hasPmtInUrl = profilePaymentListUrlIsActive(urlSearch);
  const initialProfileTab: StudentProfileTabId =
    hasPmtInUrl && visibleTabs.includes("finance")
      ? "finance"
      : visibleTabs.includes("academic")
        ? "academic"
        : (visibleTabs[0] ?? "academic");

  const viewer: StudentProfileViewerFlags = {
    canManageStaffRecords: adminOk,
    canManageAcademicNotes: adminOk || departmentRoles.has("academic"),
    canUploadAttachments: adminOk || teacherOk,
    canDeleteAttachments: adminOk,
    canChangeAvatar: adminOk,
    canRecordPayment,
    visibleTabs,
  };

  const adminClient = createAdminClient();

  // Department roles unlock full reads for their tab, matching admin behavior.
  // Teachers with a department role see the same data as admin on that tab —
  // they are not limited to students/subjects from their teaching assignments.
  // Access is strictly department-role based; legacy scopes do not elevate reads.
  const canReadAcademic = adminOk || departmentRoles.has("academic");
  const canReadDiscipline = adminOk || departmentRoles.has("discipline");
  const canReadHealth = adminOk || departmentRoles.has("health");
  const canReadFinance =
    adminOk || departmentRoles.has("finance") || isFinanceOrAccountsProfile;

  const academicClient = canReadAcademic ? adminClient : supabase;
  const disciplineClient = canReadDiscipline ? adminClient : supabase;
  const healthClient = canReadHealth ? adminClient : supabase;
  const financeClient = canReadFinance ? adminClient : supabase;

  const useFullGradebook = canReadAcademic;

  let profileSchoolLevel = normalizeSchoolLevel(undefined);
  try {
    const { data: schoolLevelRow } = await adminClient
      .from("schools")
      .select("school_level")
      .eq("id", typedStudent.school_id)
      .maybeSingle();
    profileSchoolLevel = normalizeSchoolLevel(
      (schoolLevelRow as { school_level: string | null } | null)?.school_level
    );
  } catch {
    // Pre-migration DBs without the column — keep the default.
  }

  const [
    { data: academicRows, error: academicErr },
    { data: disciplineRows, error: disciplineErr },
    { data: healthRows, error: healthErr },
    profileFinanceNotes,
    { data: schoolRow, error: schoolErr },
    profileGradebookScores,
    profileAttendanceSummary,
    profileReportCards,
    profileFeeBalances,
  ] = await Promise.all([
    academicClient
      .from("student_academic_records")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false }),
    disciplineClient
      .from("student_discipline_records")
      .select("*")
      .eq("student_id", studentId)
      .order("incident_date", { ascending: false })
      .order("created_at", { ascending: false }),
    healthClient
      .from("student_health_records")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false }),
    loadProfileFinanceNotes(financeClient, studentId),
    supabase
      .from("schools")
      .select("currency, timezone")
      .eq("id", schoolId)
      .maybeSingle(),
    useFullGradebook
      ? loadProfileGradebookScores(
          adminClient,
          studentId,
          typedStudent.school_id,
          profileSchoolLevel
        )
      : Promise.resolve([]),
    loadProfileAttendanceSummary(
      academicClient,
      studentId,
      typedStudent.class_id
    ),
    loadProfileReportCards(
      academicClient,
      studentId,
      profileSchoolLevel
    ),
    loadProfileFeeBalances(financeClient, studentId),
  ]);

  const discIds = (disciplineRows ?? []).map((r) => (r as DisciplineRow).id);
  const healthIds = (healthRows ?? []).map((r) => (r as HealthRow).id);

  let recordAttachments: AttachmentRow[] = [];
  let attachmentErr: string | null = null;

  if (discIds.length > 0 || healthIds.length > 0) {
    const orParts: string[] = [];
    if (discIds.length > 0) {
      orParts.push(
        `and(record_type.eq.discipline,record_id.in.(${discIds.join(",")}))`
      );
    }
    if (healthIds.length > 0) {
      orParts.push(
        `and(record_type.eq.health,record_id.in.(${healthIds.join(",")}))`
      );
    }
    const attachmentsClient =
      canReadDiscipline || canReadHealth ? adminClient : supabase;
    const { data: attRows, error: attErr } = await attachmentsClient
      .from("student_record_attachments")
      .select("*")
      .or(orParts.join(","))
      .order("created_at", { ascending: false });

    if (attErr) {
      attachmentErr = attErr.message;
    } else {
      recordAttachments = (attRows ?? []) as AttachmentRow[];
    }
  }

  const schoolRowTyped = schoolRow as {
    currency: string | null;
    timezone: string | null;
  } | null;
  const currencyCode = normalizeSchoolCurrency(schoolRowTyped?.currency);
  const displayTimezone = resolveSchoolDisplayTimezone(schoolRowTyped?.timezone);

  const paymentListQuery = parseProfilePaymentListQuery(urlSearch);
  const tzForPmt = displayTimezone;

  type ProfilePayRow = import("@/lib/student-profile-auto-data").ProfilePaymentRow;
  let profilePaymentsResult: {
    rows: ProfilePayRow[];
    total: number;
    error: string | null;
  } = { rows: [], total: 0, error: null };
  if (canReadFinance) {
    const first = await loadProfilePaymentHistoryPage(
      financeClient,
      studentId,
      paymentListQuery,
      tzForPmt
    );
    if (first.error) {
      profilePaymentsResult = {
        rows: [],
        total: 0,
        error: first.error,
      };
    } else if (first.total > 0) {
      const maxPage = Math.max(1, Math.ceil(first.total / paymentListQuery.per));
      if (paymentListQuery.page > maxPage) {
        const q: ProfilePaymentListQuery = {
          ...paymentListQuery,
          page: maxPage,
          offset: (maxPage - 1) * paymentListQuery.per,
        };
        redirect(
          `/dashboard/students/${studentId}/profile?${serializeProfilePaymentListQuery(q)}`
        );
      } else {
        profilePaymentsResult = first;
      }
    } else {
      profilePaymentsResult = first;
    }
  }

  const loadError = [
    academicErr && `Academic: ${academicErr.message}`,
    disciplineErr && `Discipline: ${disciplineErr.message}`,
    healthErr && `Health: ${healthErr.message}`,
    schoolErr && `School: ${schoolErr.message}`,
    scopeErr && `Attachment scopes: ${scopeErr.message}`,
    deptRoleErr && `Department roles: ${deptRoleErr.message}`,
    myProfileErr && `Profile: ${myProfileErr.message}`,
    attachmentErr && `Attachments: ${attachmentErr}`,
    profilePaymentsResult.error && `Payments: ${profilePaymentsResult.error}`,
  ]
    .filter(Boolean)
    .join(" ");

  const headerAdmission = typedStudent.admission_number?.trim() ?? "";
  const headerSubtitleName = headerAdmission
    ? `${typedStudent.full_name} (ADM: ${headerAdmission})`
    : typedStudent.full_name;

  const backToStudentsHref =
    myProfileRole === "teacher" && !adminOk
      ? "/teacher-dashboard/students"
      : "/dashboard/students";

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Student profile
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {headerSubtitleName}
              {typedStudent.class?.name ? ` · ${typedStudent.class.name}` : ""}
            </p>
          </div>
          <BackButton
            href={backToStudentsHref}
            className="inline-flex w-fit items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Back to students
          </BackButton>
        </div>
      </header>

      <main className="mx-auto max-w-5xl py-8">
        {loadError ? (
          <div
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            role="alert"
          >
            Some sections could not load ({loadError}). Apply migrations
            00078+ (student profile, payments list RPC 00111), finance notes, and
            00081_student_record_attachments if this is a fresh database.
          </div>
        ) : null}
        <StudentProfileClient
          studentId={typedStudent.id}
          studentName={typedStudent.full_name}
          admissionNumber={typedStudent.admission_number}
          className={typedStudent.class?.name ?? null}
          avatarUrl={typedStudent.avatar_url}
          viewer={viewer}
          initialActiveTab={initialProfileTab}
          recordAttachments={recordAttachments}
          academicRecords={(academicRows ?? []) as AcademicRow[]}
          disciplineRecords={(disciplineRows ?? []) as DisciplineRow[]}
          healthRecords={(healthRows ?? []) as HealthRow[]}
          profileFinanceNotes={profileFinanceNotes}
          currencyCode={currencyCode}
          profileGradebookScores={profileGradebookScores}
          profileAttendanceSummary={profileAttendanceSummary}
          profileReportCards={profileReportCards}
          profilePayments={profilePaymentsResult.rows}
          profilePaymentTotal={profilePaymentsResult.total}
          profilePaymentListQuery={paymentListQuery}
          profileFeeBalances={profileFeeBalances}
          displayTimezone={displayTimezone}
          currentUserFinanceNoteRecorderLine={currentUserFinanceNoteRecorderLine}
        />
      </main>
    </>
  );
}
