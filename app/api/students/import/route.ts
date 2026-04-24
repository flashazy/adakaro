import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin-activity-log";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { generateAdmissionNumberWithClient } from "@/lib/admission-number";
import { canAccessFeature } from "@/lib/plans";
import { checkStudentLimit, getSchoolPlanRow } from "@/lib/plan-limits";
import type { Database } from "@/types/supabase";
import {
  parseOptionalEnrollmentDate,
  todayIsoLocal,
} from "@/lib/enrollment-date";
import { getCurrentAcademicYearAndTerm } from "@/lib/student-subject-enrollment";
import {
  buildStudentDuplicateLookups,
  makeCompositeKey,
  makeNameClassKey,
  normalizePhoneDigits,
  type StudentDuplicateLookups,
} from "@/lib/student-import-duplicates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS = 500;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SUBJECTS_PER_ROW = 15;

const REQUIRED_HEADER_FIELDS = [
  "full_name",
  "admission_number",
  "class_name",
  "gender",
  "parent_name",
  "parent_email",
  "parent_phone",
] as const;

export interface ValidatedImportRow {
  line: number;
  full_name: string;
  admission_number: string | null;
  class_name: string | null;
  gender: "male" | "female" | null;
  /** Resolved YYYY-MM-DD, or null to use today at import time. */
  enrollment_date: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  /** Raw subjects cell for re-validation on import (empty = use all class subjects). */
  subjects_cell: string;
  status: "valid" | "warning" | "error";
  /** Blocking issues other than strict subject validation (class, gender, email, etc.). */
  errors: string[];
  /** When subjects are validated strictly: invalid / not-in-class subject names (blocks import unless skip). */
  subject_errors: string[];
  warnings: string[];
  resolved_class_id: string | null;
  /** When true, import enrolls the student in every subject linked to their class. */
  enroll_all_class_subjects: boolean;
  /** Subject IDs to enrol when `enroll_all_class_subjects` is false (CSV listed subjects). */
  resolved_subject_ids: string[];
  /** True when row is blocked (or warned) solely due to duplicate-detection rules. */
  duplicate_row: boolean;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = content.replace(/^\uFEFF/, "");

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || (c === "\r" && s[i + 1] === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row.map((cell) => cell.trim()));
      }
      row = [];
      if (c === "\r") i++;
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row.map((cell) => cell.trim()));
  }
  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function mapHeaderRow(headerCells: string[]): {
  requiredIdx: number[];
  enrollmentDateIdx: number | null;
  subjectsIdx: number | null;
} | null {
  const norm = headerCells.map(normalizeHeader);
  const requiredIdx: number[] = [];
  for (const want of REQUIRED_HEADER_FIELDS) {
    const pos = norm.indexOf(want);
    if (pos === -1) return null;
    requiredIdx.push(pos);
  }
  const ed = norm.indexOf("enrollment_date");
  const sj = norm.indexOf("subjects");
  return {
    requiredIdx,
    enrollmentDateIdx: ed === -1 ? null : ed,
    subjectsIdx: sj === -1 ? null : sj,
  };
}

/** Gender must be exactly male or female (CSV column is required). */
function parseGenderCell(raw: string): {
  gender: "male" | "female" | null;
  genderWarnings: string[];
  genderErrors: string[];
} {
  const g = raw.trim().toLowerCase();
  if (g === "male" || g === "female") {
    return { gender: g, genderWarnings: [], genderErrors: [] };
  }
  return {
    gender: null,
    genderWarnings: [],
    genderErrors: ["Gender is required. Must be 'male' or 'female'."],
  };
}

/** If provided, require enough digits for a plausible phone number. */
function validateParentPhone(phone: string | null): string | null {
  if (phone == null || phone.trim() === "") return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) {
    return "parent_phone does not look like a valid phone number.";
  }
  return null;
}

/**
 * Split comma-separated subject names; trim segments; cap at MAX_SUBJECTS_PER_ROW.
 */
function parseSubjectNamesFromCell(
  raw: string,
  warningsOut: string[]
): string[] {
  const trimmed = raw.trim();
  if (trimmed === "") return [];
  const parts = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  if (parts.length > MAX_SUBJECTS_PER_ROW) {
    warningsOut.push(
      `Only the first ${MAX_SUBJECTS_PER_ROW} subjects are used; extra names were ignored.`
    );
    return parts.slice(0, MAX_SUBJECTS_PER_ROW);
  }
  return parts;
}

/** Used when the name is unknown at the school or not linked to the student's class. */
function subjectValidationError(subjectName: string, classLabel: string): string {
  return `Subject '${subjectName}' not found in class '${classLabel}'. Please check subject names or add subject to class.`;
}

const MSG_DUP_COMPOSITE =
  "Student already exists with same name, class, and parent phone";

function validateOneDataRow(
  line: number,
  full_name: string,
  admission_number: string | null,
  class_name: string | null,
  gender_raw: string,
  enrollment_date_raw: string,
  parent_name: string | null,
  parent_email: string | null,
  parent_phone: string | null,
  subjects_cell: string,
  classNameToId: Map<string, string>,
  sortedClassNames: string[],
  defaultClassId: string | null,
  duplicateLookups: StudentDuplicateLookups,
  admissionFirstLine: Map<string, number>,
  compositeFirstLineInFile: Map<string, number>,
  subjectNameToId: Map<string, string>,
  classIdToAllowedSubjectIds: Map<string, Set<string>>,
  options?: { subjectsStrict?: boolean }
): ValidatedImportRow {
  const subjectsStrict = options?.subjectsStrict ?? true;
  const errors: string[] = [];
  const subject_errors: string[] = [];
  const warnings: string[] = [];

  const {
    gender: parsedGender,
    genderWarnings,
    genderErrors,
  } = parseGenderCell(gender_raw);
  errors.push(...genderErrors);
  warnings.push(...genderWarnings);

  const enrollmentParsed = parseOptionalEnrollmentDate(enrollment_date_raw);
  if (enrollmentParsed.error) {
    errors.push(enrollmentParsed.error);
  }
  const enrollment_date = enrollmentParsed.error
    ? null
    : enrollmentParsed.iso;

  const classNameTrimmed = (class_name ?? "").trim();
  const cn = classNameTrimmed === "" ? null : classNameTrimmed;

  if (!full_name.trim()) {
    errors.push("Missing full name.");
  }

  if (parent_email != null && !EMAIL_RE.test(parent_email)) {
    errors.push("parent_email is not a valid email address.");
  }

  const phoneErr = validateParentPhone(parent_phone);
  if (phoneErr) {
    errors.push(phoneErr);
  }

  if (admission_number != null) {
    const key = admission_number.toLowerCase();
    const first = admissionFirstLine.get(key);
    if (first != null) {
      errors.push(
        `Duplicate admission_number in file (also on row ${first}).`
      );
    } else {
      admissionFirstLine.set(key, line);
    }
    if (duplicateLookups.admissionLowerSet.has(key)) {
      errors.push(
        `Student already exists with admission number: ${admission_number.trim()}`
      );
    }
  } else {
    warnings.push(
      "Admission number will be assigned automatically when you import."
    );
  }

  let resolved_class_id: string | null = null;
  if (!defaultClassId) {
    errors.push(
      "School has no classes. Create a class before importing students."
    );
  } else if (cn == null) {
    resolved_class_id = defaultClassId;
    const defName = sortedClassNames[0] ?? "default";
    warnings.push(`No class_name; assigned to "${defName}".`);
  } else {
    const id = classNameToId.get(cn);
    if (id) {
      resolved_class_id = id;
    } else {
      errors.push(`Class "${cn}" not found.`);
    }
  }

  let enroll_all_class_subjects = true;
  let resolved_subject_ids: string[] = [];

  const defaultClassName = sortedClassNames[0] ?? "this class";
  const classLabelForSubjects =
    cn ?? defaultClassName;

  const hasValidPhone =
    !phoneErr &&
    parent_phone != null &&
    normalizePhoneDigits(parent_phone).length >= 8;

  const resolvedClassNameForDup = cn ?? sortedClassNames[0] ?? "";
  let compKeyForFile: string | null = null;
  let duplicateCompositeBlocked = false;
  if (errors.length === 0 && resolved_class_id && hasValidPhone) {
    compKeyForFile = makeCompositeKey(
      full_name.trim(),
      resolvedClassNameForDup,
      parent_phone
    );
    if (compKeyForFile) {
      const inDbComposite =
        admission_number == null &&
        duplicateLookups.compositeExactSet.has(compKeyForFile);
      const prevLine = compositeFirstLineInFile.get(compKeyForFile);
      if (inDbComposite) {
        errors.push(MSG_DUP_COMPOSITE);
        duplicateCompositeBlocked = true;
      } else if (prevLine != null) {
        errors.push(MSG_DUP_COMPOSITE);
        duplicateCompositeBlocked = true;
      }
    }
  }

  if (
    errors.length === 0 &&
    resolved_class_id &&
    hasValidPhone &&
    !duplicateCompositeBlocked &&
    parent_phone != null
  ) {
    const ncKey = makeNameClassKey(full_name.trim(), resolvedClassNameForDup);
    const csvDigits = normalizePhoneDigits(parent_phone);
    const phones = duplicateLookups.nameClassToPhones.get(ncKey);
    if (phones && phones.size > 0 && !phones.has(csvDigits)) {
      warnings.push(
        "Student with same name and class exists but with different parent phone. Review if this is a duplicate."
      );
    }
  }

  if (errors.length === 0 && resolved_class_id) {
    const allowed =
      classIdToAllowedSubjectIds.get(resolved_class_id) ?? new Set();
    const subjectParseWarnings: string[] = [];
    const requested = parseSubjectNamesFromCell(
      subjects_cell,
      subjectParseWarnings
    );
    warnings.push(...subjectParseWarnings);

    if (subjects_cell.trim() !== "") {
      enroll_all_class_subjects = false;
      let skippedInvalidCount = 0;
      for (const name of requested) {
        const sid = subjectNameToId.get(name);
        if (!sid) {
          if (subjectsStrict) {
            subject_errors.push(subjectValidationError(name, classLabelForSubjects));
          } else {
            skippedInvalidCount += 1;
          }
          continue;
        }
        if (!allowed.has(sid)) {
          if (subjectsStrict) {
            subject_errors.push(subjectValidationError(name, classLabelForSubjects));
          } else {
            skippedInvalidCount += 1;
          }
          continue;
        }
        if (!resolved_subject_ids.includes(sid)) {
          resolved_subject_ids.push(sid);
        }
      }
      if (!subjectsStrict && skippedInvalidCount > 0) {
        warnings.push(
          `${skippedInvalidCount} listed subject name(s) were skipped (not found or not assigned to this class).`
        );
      }
    } else {
      enroll_all_class_subjects = true;
      resolved_subject_ids = [];
    }
  }

  const hardBlocked = errors.length > 0;
  const subjectBlocked = subjectsStrict && subject_errors.length > 0;
  const rowImportBlocked = hardBlocked || subjectBlocked;

  let status: ValidatedImportRow["status"];
  if (rowImportBlocked) {
    status = "error";
  } else if (warnings.length > 0) {
    status = "warning";
  } else {
    status = "valid";
  }

  const duplicate_row = errors.some(
    (e) =>
      e.startsWith("Student already exists with admission number:") ||
      e === MSG_DUP_COMPOSITE ||
      e.startsWith("Duplicate admission_number in file")
  );

  if (
    (status === "valid" || status === "warning") &&
    compKeyForFile &&
    !duplicateCompositeBlocked
  ) {
    compositeFirstLineInFile.set(compKeyForFile, line);
  }

  return {
    line,
    full_name: full_name.trim(),
    admission_number,
    class_name: cn,
    gender: hardBlocked ? null : parsedGender,
    enrollment_date,
    parent_name,
    parent_email,
    parent_phone,
    subjects_cell: subjects_cell.trim(),
    status,
    errors,
    subject_errors,
    warnings,
    resolved_class_id: hardBlocked ? null : resolved_class_id,
    enroll_all_class_subjects: hardBlocked ? true : enroll_all_class_subjects,
    resolved_subject_ids: hardBlocked ? [] : resolved_subject_ids,
    duplicate_row,
  };
}

function validateAndBuildRows(
  grid: string[][],
  classNameToId: Map<string, string>,
  sortedClassNames: string[],
  defaultClassId: string | null,
  duplicateLookups: StudentDuplicateLookups,
  subjectNameToId: Map<string, string>,
  classIdToAllowedSubjectIds: Map<string, Set<string>>
): ValidatedImportRow[] {
  if (grid.length === 0) return [];

  const headerIdx = mapHeaderRow(grid[0]);
  if (!headerIdx) {
    return [
      {
        line: 1,
        full_name: "",
        admission_number: null,
        class_name: null,
        gender: null,
        enrollment_date: null,
        parent_name: null,
        parent_email: null,
        parent_phone: null,
        subjects_cell: "",
        status: "error",
        errors: [
          `Header must include columns: ${REQUIRED_HEADER_FIELDS.join(", ")} (order may vary). Optional: enrollment_date (2026-04-24, 24/04/2026, or 24-04-2026; blank = today), subjects (comma-separated names).`,
        ],
        subject_errors: [],
        warnings: [],
        resolved_class_id: null,
        enroll_all_class_subjects: true,
        resolved_subject_ids: [],
        duplicate_row: false,
      },
    ];
  }

  const dataRows = grid.slice(1);
  const admissionFirstLine = new Map<string, number>();
  const compositeFirstLineInFile = new Map<string, number>();
  const hi = headerIdx.requiredIdx;

  const out: ValidatedImportRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const line = r + 2;
    const cells = dataRows[r];
    const full_name = (cells[hi[0]] ?? "").trim();
    const admission_raw = (cells[hi[1]] ?? "").trim();
    const class_name_cell = (cells[hi[2]] ?? "").trim();
    const gender_raw = (cells[hi[3]] ?? "").trim();
    const parent_name_raw = (cells[hi[4]] ?? "").trim();
    const parent_email_raw = (cells[hi[5]] ?? "").trim();
    const parent_phone_raw = (cells[hi[6]] ?? "").trim();
    const enrollment_date_raw =
      headerIdx.enrollmentDateIdx != null
        ? (cells[headerIdx.enrollmentDateIdx] ?? "").trim()
        : "";
    const subjects_cell =
      headerIdx.subjectsIdx != null
        ? (cells[headerIdx.subjectsIdx] ?? "").trim()
        : "";

    const admission_number = admission_raw === "" ? null : admission_raw;
    const parent_name = parent_name_raw === "" ? null : parent_name_raw;
    const parent_email = parent_email_raw === "" ? null : parent_email_raw;
    const parent_phone = parent_phone_raw === "" ? null : parent_phone_raw;

    out.push(
      validateOneDataRow(
        line,
        full_name,
        admission_number,
        class_name_cell === "" ? null : class_name_cell,
        gender_raw,
        enrollment_date_raw,
        parent_name,
        parent_email,
        parent_phone,
        subjects_cell,
        classNameToId,
        sortedClassNames,
        defaultClassId,
        duplicateLookups,
        admissionFirstLine,
        compositeFirstLineInFile,
        subjectNameToId,
        classIdToAllowedSubjectIds,
        { subjectsStrict: true }
      )
    );
  }

  return out;
}

function validateImportRows(
  incoming: {
    line: number;
    full_name: string;
    admission_number: string | null;
    class_name: string | null;
    gender: string;
    enrollment_date?: string | null;
    parent_name: string | null;
    parent_email: string | null;
    parent_phone: string | null;
    subjects_cell?: string;
  }[],
  classNameToId: Map<string, string>,
  sortedClassNames: string[],
  defaultClassId: string | null,
  duplicateLookups: StudentDuplicateLookups,
  subjectNameToId: Map<string, string>,
  classIdToAllowedSubjectIds: Map<string, Set<string>>,
  skipInvalidSubjects?: boolean
): ValidatedImportRow[] {
  const admissionFirstLine = new Map<string, number>();
  const compositeFirstLineInFile = new Map<string, number>();
  const sorted = [...incoming].sort((a, b) => a.line - b.line);
  const subjectsStrict = !skipInvalidSubjects;
  return sorted.map((row) =>
    validateOneDataRow(
      row.line,
      row.full_name,
      row.admission_number,
      row.class_name,
      row.gender,
      row.enrollment_date ?? "",
      row.parent_name,
      row.parent_email,
      row.parent_phone,
      row.subjects_cell ?? "",
      classNameToId,
      sortedClassNames,
      defaultClassId,
      duplicateLookups,
      admissionFirstLine,
      compositeFirstLineInFile,
      subjectNameToId,
      classIdToAllowedSubjectIds,
      { subjectsStrict }
    )
  );
}

type ImportBody =
  | { action: "validate"; csv: string }
  | {
      action: "import";
      skip_invalid_subjects?: boolean;
      rows: {
        line: number;
        full_name: string;
        admission_number: string | null;
        class_name: string | null;
        gender: string;
        enrollment_date?: string | null;
        parent_name: string | null;
        parent_email: string | null;
        parent_phone: string | null;
        subjects_cell?: string;
      }[];
    };

async function insertStudentSubjectEnrollmentsForImport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    studentId: string;
    classId: string;
    enrollAllClassSubjects: boolean;
    explicitSubjectIds: string[];
    enrollmentDateIso: string;
  }
): Promise<string[]> {
  const warn: string[] = [];
  const { academicYear, term } = getCurrentAcademicYearAndTerm();
  let subjectIds: string[] = [];

  if (params.enrollAllClassSubjects) {
    const { data: linkRows, error: linkErr } = await supabase
      .from("subject_classes")
      .select("subject_id")
      .eq("class_id", params.classId);
    if (linkErr) {
      warn.push(`Subject enrolment skipped: ${linkErr.message}`);
      return warn;
    }
    subjectIds = [
      ...new Set(
        (linkRows ?? []).map((r) => (r as { subject_id: string }).subject_id)
      ),
    ];
  } else {
    subjectIds = [...new Set(params.explicitSubjectIds.filter(Boolean))];
  }

  if (subjectIds.length === 0) {
    return warn;
  }

  const { data: allowedRows, error: allowErr } = await supabase
    .from("subject_classes")
    .select("subject_id")
    .eq("class_id", params.classId)
    .in("subject_id", subjectIds);

  if (allowErr) {
    warn.push(`Subject enrolment skipped: ${allowErr.message}`);
    return warn;
  }
  const allowed = new Set(
    (allowedRows ?? []).map((r) => (r as { subject_id: string }).subject_id)
  );
  const filtered = subjectIds.filter((id) => allowed.has(id));
  if (filtered.length < subjectIds.length) {
    warn.push(
      "Some subjects were not linked to this class; enrolment was adjusted."
    );
  }
  if (filtered.length === 0) {
    return warn;
  }

  const from = params.enrollmentDateIso;
  const rows = filtered.map((subject_id) => ({
    student_id: params.studentId,
    subject_id,
    class_id: params.classId,
    academic_year: academicYear,
    term,
    enrolled_from: from,
  }));

  const { error: insErr } = await supabase
    .from("student_subject_enrollment")
    .insert(rows as never);

  if (insErr) {
    warn.push(`Subject enrolment failed: ${insErr.message}`);
  }
  return warn;
}

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
        { error: "No school found for your account." },
        { status: 400 }
      );
    }

    const { data: isAdmin, error: adminRpcErr } = await supabase.rpc(
      "is_school_admin",
      { p_school_id: schoolId } as never
    );
    if (adminRpcErr || !isAdmin) {
      return NextResponse.json(
        { error: "You must be a school admin to import students." },
        { status: 403 }
      );
    }

    const planRow = await getSchoolPlanRow(supabase, schoolId);
    const plan = planRow?.plan ?? "free";
    if (!canAccessFeature(plan, "bulkImport")) {
      return NextResponse.json(
        {
          error:
            "Bulk student import is available on Pro and Enterprise plans. Upgrade to unlock.",
          upgradeUrl: "/pricing",
        },
        { status: 403 }
      );
    }

    let body: ImportBody;
    try {
      body = (await request.json()) as ImportBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { data: classRows, error: classesError } = await supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name");

    if (classesError) {
      return NextResponse.json(
        { error: classesError.message },
        { status: 500 }
      );
    }

    const classes = (classRows ?? []) as { id: string; name: string }[];
    const sortedClassNames = classes.map((c) => c.name);
    const classNameToId = new Map(classes.map((c) => [c.name, c.id]));
    const classIdToName = new Map(classes.map((c) => [c.id, c.name]));
    const defaultClassId = classes[0]?.id ?? null;

    const { data: existingStudents, error: stuErr } = await supabase
      .from("students")
      .select("admission_number, full_name, parent_phone, class_id")
      .eq("school_id", schoolId);

    if (stuErr) {
      return NextResponse.json({ error: stuErr.message }, { status: 500 });
    }

    const duplicateLookups = buildStudentDuplicateLookups(
      (existingStudents ?? []) as {
        admission_number: string | null;
        full_name: string;
        parent_phone: string | null;
        class_id: string;
      }[],
      classIdToName
    );

    const { data: subjectRows, error: subjectsError } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name");

    if (subjectsError) {
      return NextResponse.json(
        { error: subjectsError.message },
        { status: 500 }
      );
    }

    const subjectNameToId = new Map<string, string>();
    for (const s of subjectRows ?? []) {
      const row = s as { id: string; name: string };
      const name = (row.name ?? "").trim();
      if (!name) continue;
      if (!subjectNameToId.has(name)) {
        subjectNameToId.set(name, row.id);
      }
    }

    const classIds = classes.map((c) => c.id);
    const classIdToAllowedSubjectIds = new Map<string, Set<string>>();
    for (const cid of classIds) {
      classIdToAllowedSubjectIds.set(cid, new Set());
    }
    if (classIds.length > 0) {
      const { data: scRows, error: scErr } = await supabase
        .from("subject_classes")
        .select("class_id, subject_id")
        .in("class_id", classIds);

      if (scErr) {
        return NextResponse.json({ error: scErr.message }, { status: 500 });
      }
      for (const r of scRows ?? []) {
        const row = r as { class_id: string; subject_id: string };
        classIdToAllowedSubjectIds.get(row.class_id)?.add(row.subject_id);
      }
    }

    const { data: schoolAdmissionRow, error: schoolAdmissionErr } =
      await supabase
        .from("schools")
        .select("admission_prefix")
        .eq("id", schoolId)
        .maybeSingle();

    if (schoolAdmissionErr) {
      return NextResponse.json(
        { error: schoolAdmissionErr.message },
        { status: 500 }
      );
    }

    const schoolAdmissionPrefix = (
      schoolAdmissionRow as { admission_prefix: string | null } | null
    )?.admission_prefix?.trim();

    if (body.action === "validate") {
      const csv = String(body.csv ?? "");
      const byteLength = new TextEncoder().encode(csv).length;
      if (byteLength > MAX_BYTES) {
        return NextResponse.json(
          { error: `File too large. Maximum size is ${MAX_BYTES / (1024 * 1024)}MB.` },
          { status: 400 }
        );
      }

      const grid = parseCsv(csv);
      const dataRowCount = Math.max(0, grid.length - 1);
      if (dataRowCount > MAX_ROWS) {
        return NextResponse.json(
          { error: `Too many rows. Maximum is ${MAX_ROWS} data rows per import.` },
          { status: 400 }
        );
      }

      const rows = validateAndBuildRows(
        grid,
        classNameToId,
        sortedClassNames,
        defaultClassId,
        duplicateLookups,
        subjectNameToId,
        classIdToAllowedSubjectIds
      );

      const needsAutoAdmission = rows.some(
        (r) => r.admission_number == null && r.errors.length === 0
      );
      if (needsAutoAdmission && !schoolAdmissionPrefix) {
        return NextResponse.json(
          {
            error:
              "Your school has no admission prefix. Set it under School settings, or provide admission_number for every row in the CSV.",
          },
          { status: 400 }
        );
      }

      const validCount = rows.filter((r) => r.status === "valid").length;
      const warnCount = rows.filter((r) => r.status === "warning").length;
      const errCount = rows.filter((r) => r.status === "error").length;
      const readyToImport = validCount + warnCount;
      const rowsWithSubjectErrors = rows.filter(
        (r) => r.subject_errors.length > 0
      ).length;
      const allRowsDuplicateOnly =
        rows.length > 0 &&
        rows.every(
          (r) =>
            r.status === "error" &&
            r.duplicate_row &&
            r.subject_errors.length === 0 &&
            r.errors.every(
              (e) =>
                e.startsWith("Student already exists with admission number:") ||
                e === MSG_DUP_COMPOSITE ||
                e.startsWith("Duplicate admission_number in file")
            )
        );

      return NextResponse.json({
        rows,
        preview: rows.slice(0, 10),
        summary: {
          valid: validCount,
          warnings: warnCount,
          errors: errCount,
          ready_to_import: readyToImport,
          rows_with_subject_errors: rowsWithSubjectErrors,
          all_rows_duplicate_only: allRowsDuplicateOnly,
        },
      });
    }

    if (body.action === "import") {
      const incoming = body.rows ?? [];
      if (incoming.length === 0) {
        return NextResponse.json(
          { error: "No rows to import." },
          { status: 400 }
        );
      }
      if (incoming.length > MAX_ROWS) {
        return NextResponse.json(
          { error: `Too many rows. Maximum is ${MAX_ROWS}.` },
          { status: 400 }
        );
      }

      const skipInvalidSubjects = Boolean(body.skip_invalid_subjects);
      const validated = validateImportRows(
        incoming,
        classNameToId,
        sortedClassNames,
        defaultClassId,
        duplicateLookups,
        subjectNameToId,
        classIdToAllowedSubjectIds,
        skipInvalidSubjects
      );

      const needsAutoAdmissionImport = validated.some(
        (r) => r.admission_number == null && r.status !== "error"
      );
      if (needsAutoAdmissionImport && !schoolAdmissionPrefix) {
        return NextResponse.json(
          {
            error:
              "Your school has no admission prefix. Set it under School settings, or provide admission_number for every row.",
          },
          { status: 400 }
        );
      }

      const toInsert = validated.filter((r) => r.status !== "error");
      const skipped = validated.filter((r) => r.status === "error");

      const limitState = await checkStudentLimit(supabase, schoolId);
      let remaining =
        limitState.limit == null
          ? Number.POSITIVE_INFINITY
          : Math.max(0, limitState.limit - limitState.current);

      type InsertRow = Database["public"]["Tables"]["students"]["Insert"];
      const successLines: number[] = [];
      const warningImports: { line: number; warnings: string[] }[] = [];
      const insertErrors: { line: number; full_name: string; message: string }[] =
        [];
      const duplicateSkips: {
        line: number;
        full_name: string;
        reason: string;
      }[] = [];
      const admissionsAfterInsert = new Set(duplicateLookups.admissionLowerSet);
      const batchCompositeSet = new Set(duplicateLookups.compositeExactSet);

      for (const r of toInsert) {
        if (!r.resolved_class_id) {
          insertErrors.push({
            line: r.line,
            full_name: r.full_name,
            message: "Missing class assignment.",
          });
          continue;
        }

        let admissionToUse = r.admission_number?.trim() || null;
        if (!admissionToUse) {
          try {
            admissionToUse = await generateAdmissionNumberWithClient(
              supabase,
              schoolId
            );
          } catch (e) {
            insertErrors.push({
              line: r.line,
              full_name: r.full_name,
              message:
                e instanceof Error
                  ? e.message
                  : "Could not generate admission number.",
            });
            continue;
          }
        }

        const resolvedClassName =
          classIdToName.get(r.resolved_class_id) ?? "";
        const compKey = makeCompositeKey(
          r.full_name,
          resolvedClassName,
          r.parent_phone
        );

        const k = admissionToUse.toLowerCase();
        if (admissionsAfterInsert.has(k)) {
          duplicateSkips.push({
            line: r.line,
            full_name: r.full_name,
            reason: `Student already exists with admission number: ${admissionToUse}`,
          });
          continue;
        }

        if (compKey && batchCompositeSet.has(compKey)) {
          duplicateSkips.push({
            line: r.line,
            full_name: r.full_name,
            reason: MSG_DUP_COMPOSITE,
          });
          continue;
        }

        if (remaining <= 0) {
          insertErrors.push({
            line: r.line,
            full_name: r.full_name,
            message:
              "Plan student limit reached. Upgrade to add more students.",
          });
          continue;
        }

        if (r.gender !== "male" && r.gender !== "female") {
          insertErrors.push({
            line: r.line,
            full_name: r.full_name,
            message: "Gender is required. Must be 'male' or 'female'.",
          });
          continue;
        }

        const row: InsertRow = {
          school_id: schoolId,
          class_id: r.resolved_class_id,
          full_name: r.full_name,
          admission_number: admissionToUse,
          gender: r.gender,
          enrollment_date: r.enrollment_date ?? todayIsoLocal(),
          parent_email: r.parent_email,
          parent_name: r.parent_name,
          parent_phone: r.parent_phone,
        };

        const { data: insertedStudent, error: insErr } = await supabase
          .from("students")
          .insert(row as never)
          .select("id")
          .single();

        if (insErr) {
          if (insErr.code === "23505") {
            duplicateSkips.push({
              line: r.line,
              full_name: r.full_name,
              reason: `Student already exists with admission number: ${admissionToUse}`,
            });
          } else {
            insertErrors.push({
              line: r.line,
              full_name: r.full_name,
              message: insErr.message,
            });
          }
          continue;
        }

        const newStudentId = (insertedStudent as { id: string } | null)?.id;
        if (newStudentId && r.resolved_class_id) {
          const enrWarns = await insertStudentSubjectEnrollmentsForImport(
            supabase,
            {
              studentId: newStudentId,
              classId: r.resolved_class_id,
              enrollAllClassSubjects: r.enroll_all_class_subjects,
              explicitSubjectIds: r.resolved_subject_ids,
              enrollmentDateIso: r.enrollment_date ?? todayIsoLocal(),
            }
          );
          const mergedWarnings = [...r.warnings, ...enrWarns];
          if (mergedWarnings.length > 0) {
            warningImports.push({
              line: r.line,
              warnings: mergedWarnings,
            });
          }
        } else if (r.warnings.length > 0) {
          warningImports.push({ line: r.line, warnings: [...r.warnings] });
        }

        admissionsAfterInsert.add(admissionToUse.toLowerCase());
        if (compKey) {
          batchCompositeSet.add(compKey);
        }
        remaining -= 1;
        successLines.push(r.line);
      }

      const validationSkippedDetails = skipped.map((r) => ({
        line: r.line,
        full_name: r.full_name,
        reasons: [...r.errors, ...r.subject_errors],
      }));

      const otherSkippedDetails = [
        ...validationSkippedDetails,
        ...insertErrors.map((e) => ({
          line: e.line,
          full_name: e.full_name,
          reasons: [e.message],
        })),
      ];

      const skippedWithReasons = [
        ...duplicateSkips.map((d) => ({
          line: d.line,
          full_name: d.full_name,
          reasons: [d.reason],
        })),
        ...otherSkippedDetails.map((s) => ({
          line: s.line,
          full_name: s.full_name,
          reasons: s.reasons,
        })),
      ];

      const partialDupPhrase =
        "Student with same name and class exists but with different parent phone";
      const warningPossibleDuplicates = warningImports
        .map((w) => {
          const dupMsgs = w.warnings.filter((m) => m.includes(partialDupPhrase));
          if (dupMsgs.length === 0) return null;
          const row = validated.find((vr) => vr.line === w.line);
          return {
            line: w.line,
            full_name: row?.full_name ?? "",
            messages: dupMsgs,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);

      const noNewStudentsAllDuplicates =
        successLines.length === 0 &&
        duplicateSkips.length > 0 &&
        duplicateSkips.length === toInsert.length &&
        insertErrors.length === 0 &&
        skipped.length === 0;

      if (successLines.length > 0) {
        revalidatePath("/dashboard/students");
        void logAdminAction({
          userId: user.id,
          action: "import_students_bulk",
          schoolId,
          details: {
            imported_count: successLines.length,
            skipped_count: skippedWithReasons.length,
          },
          request,
        });
      }

      return NextResponse.json({
        imported: successLines.length,
        importedWithWarnings: warningImports,
        duplicate_skipped: duplicateSkips,
        other_skipped_details: otherSkippedDetails,
        warning_possible_duplicates: warningPossibleDuplicates,
        skipped: skippedWithReasons.length,
        skippedDetails: skippedWithReasons,
        successLines,
        no_new_students_all_duplicates: noNewStudentsAllDuplicates,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
