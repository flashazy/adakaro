import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { canAccessFeature } from "@/lib/plans";
import {
  getSchoolPlanRow,
  resolveSchoolPlanIdForFeatures,
} from "@/lib/plan-limits";
import {
  buildReportsExportCsv,
  type BalanceRow,
  type ClassRow,
  type PaymentRow,
  type ReportExportTab,
  type StudentClassRow,
} from "@/lib/reports/build-export-csv";
import { orderStudentsByGenderThenName } from "@/lib/student-list-order";

const TABS: ReportExportTab[] = [
  "student-fees",
  "class-summary",
  "outstanding",
  "monthly-income",
];

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

    const planRow = await getSchoolPlanRow(supabase, schoolId);
    const planId = await resolveSchoolPlanIdForFeatures(
      supabase,
      schoolId,
      planRow?.plan
    );
    if (!canAccessFeature(planId, "advancedReports")) {
      return NextResponse.json(
        {
          error:
            "CSV export is available on Basic and higher plans. Upgrade to unlock.",
          upgradeUrl: "/pricing",
        },
        { status: 403 }
      );
    }

    let body: { tab?: string; dateFrom?: string; dateTo?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const tab = body.tab as ReportExportTab;
    if (!TABS.includes(tab)) {
      return NextResponse.json({ error: "Invalid tab." }, { status: 400 });
    }

    const dateFrom = String(body.dateFrom ?? "");
    const dateTo = String(body.dateTo ?? "");

    const { data: schoolStudents, error: schoolStudentsError } =
      await orderStudentsByGenderThenName(
        supabase
          .from("students")
          .select("id, class_id")
          .eq("school_id", schoolId)
      );

    if (schoolStudentsError) {
      return NextResponse.json(
        { error: schoolStudentsError.message },
        { status: 500 }
      );
    }

    const typedSchoolStudents = (schoolStudents ?? []) as StudentClassRow[];
    const studentIds = typedSchoolStudents.map((s) => s.id);

    const [balancesRes, paymentsRes, classesRes] = await Promise.all([
      supabase
        .from("student_fee_balances")
        .select(
          "student_id, student_name, fee_structure_id, fee_name, total_fee, total_paid, balance, due_date"
        )
        .in("student_id", studentIds.length > 0 ? studentIds : [""]),
      supabase
        .from("payments")
        .select("id, student_id, amount, payment_method, payment_date, reference_number")
        .in("student_id", studentIds.length > 0 ? studentIds : [""])
        .order("payment_date", { ascending: false }),
      supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),
    ]);

    if (balancesRes.error || paymentsRes.error || classesRes.error) {
      return NextResponse.json(
        {
          error:
            balancesRes.error?.message ||
            paymentsRes.error?.message ||
            classesRes.error?.message ||
            "Could not load report data.",
        },
        { status: 500 }
      );
    }

    const balances = (balancesRes.data ?? []) as BalanceRow[];
    const payments = (paymentsRes.data ?? []) as PaymentRow[];
    const classes = (classesRes.data ?? []) as ClassRow[];

    const { filename, csv } = buildReportsExportCsv(
      tab,
      balances,
      payments,
      classes,
      typedSchoolStudents,
      dateFrom,
      dateTo
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
