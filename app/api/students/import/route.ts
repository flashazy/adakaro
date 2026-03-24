import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import type { Database } from "@/types/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS = 500;
const MAX_BYTES = 5 * 1024 * 1024;

const HEADER_FIELDS = [
  "full_name",
  "admission_number",
  "class_name",
  "parent_email",
] as const;

export interface ValidatedImportRow {
  line: number;
  full_name: string;
  admission_number: string | null;
  class_name: string | null;
  parent_email: string | null;
  status: "valid" | "warning" | "error";
  errors: string[];
  warnings: string[];
  resolved_class_id: string | null;
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

function mapHeaderRow(headerCells: string[]): number[] | null {
  const norm = headerCells.map(normalizeHeader);
  const idx: number[] = [];
  for (const want of HEADER_FIELDS) {
    const pos = norm.indexOf(want);
    if (pos === -1) return null;
    idx.push(pos);
  }
  return idx;
}

function validateOneDataRow(
  line: number,
  full_name: string,
  admission_number: string | null,
  class_name: string | null,
  parent_email: string | null,
  classNameToId: Map<string, string>,
  sortedClassNames: string[],
  defaultClassId: string | null,
  existingAdmissions: Set<string>,
  admissionFirstLine: Map<string, number>
): ValidatedImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const classNameTrimmed = (class_name ?? "").trim();
  const cn = classNameTrimmed === "" ? null : classNameTrimmed;

  if (!full_name.trim()) {
    errors.push("full_name is required.");
  }

  if (parent_email != null && !EMAIL_RE.test(parent_email)) {
    errors.push("parent_email is not a valid email address.");
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
    if (existingAdmissions.has(key)) {
      errors.push("This admission number already exists for your school.");
    }
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
      resolved_class_id = defaultClassId;
      const defName = sortedClassNames[0] ?? "";
      warnings.push(
        `Class "${cn}" not found (exact match required); assigned to "${defName}".`
      );
    }
  }

  let status: ValidatedImportRow["status"];
  if (errors.length > 0) {
    status = "error";
  } else if (warnings.length > 0) {
    status = "warning";
  } else {
    status = "valid";
  }

  return {
    line,
    full_name: full_name.trim(),
    admission_number,
    class_name: cn,
    parent_email,
    status,
    errors,
    warnings,
    resolved_class_id: errors.length > 0 ? null : resolved_class_id,
  };
}

function validateAndBuildRows(
  grid: string[][],
  classNameToId: Map<string, string>,
  sortedClassNames: string[],
  defaultClassId: string | null,
  existingAdmissions: Set<string>
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
        parent_email: null,
        status: "error",
        errors: [
          `Header must include columns: ${HEADER_FIELDS.join(", ")} (order may vary).`,
        ],
        warnings: [],
        resolved_class_id: null,
      },
    ];
  }

  const dataRows = grid.slice(1);
  const admissionFirstLine = new Map<string, number>();

  const out: ValidatedImportRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const line = r + 2;
    const cells = dataRows[r];
    const full_name = (cells[headerIdx[0]] ?? "").trim();
    const admission_raw = (cells[headerIdx[1]] ?? "").trim();
    const class_name_cell = (cells[headerIdx[2]] ?? "").trim();
    const parent_email_raw = (cells[headerIdx[3]] ?? "").trim();

    const admission_number = admission_raw === "" ? null : admission_raw;
    const parent_email = parent_email_raw === "" ? null : parent_email_raw;

    out.push(
      validateOneDataRow(
        line,
        full_name,
        admission_number,
        class_name_cell === "" ? null : class_name_cell,
        parent_email,
        classNameToId,
        sortedClassNames,
        defaultClassId,
        existingAdmissions,
        admissionFirstLine
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
    parent_email: string | null;
  }[],
  classNameToId: Map<string, string>,
  sortedClassNames: string[],
  defaultClassId: string | null,
  existingAdmissions: Set<string>
): ValidatedImportRow[] {
  const admissionFirstLine = new Map<string, number>();
  const sorted = [...incoming].sort((a, b) => a.line - b.line);
  return sorted.map((row) =>
    validateOneDataRow(
      row.line,
      row.full_name,
      row.admission_number,
      row.class_name,
      row.parent_email,
      classNameToId,
      sortedClassNames,
      defaultClassId,
      existingAdmissions,
      admissionFirstLine
    )
  );
}

type ImportBody =
  | { action: "validate"; csv: string }
  | {
      action: "import";
      rows: {
        line: number;
        full_name: string;
        admission_number: string | null;
        class_name: string | null;
        parent_email: string | null;
      }[];
    };

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
    const defaultClassId = classes[0]?.id ?? null;

    const { data: existingStudents, error: stuErr } = await supabase
      .from("students")
      .select("admission_number")
      .eq("school_id", schoolId);

    if (stuErr) {
      return NextResponse.json({ error: stuErr.message }, { status: 500 });
    }

    const existingAdmissions = new Set<string>();
    for (const s of existingStudents ?? []) {
      const a = (s as { admission_number: string | null }).admission_number;
      if (a != null && String(a).trim() !== "") {
        existingAdmissions.add(String(a).trim().toLowerCase());
      }
    }

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
        existingAdmissions
      );

      const validCount = rows.filter((r) => r.status === "valid").length;
      const warnCount = rows.filter((r) => r.status === "warning").length;
      const errCount = rows.filter((r) => r.status === "error").length;

      return NextResponse.json({
        rows,
        preview: rows.slice(0, 10),
        summary: { valid: validCount, warnings: warnCount, errors: errCount },
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

      const validated = validateImportRows(
        incoming,
        classNameToId,
        sortedClassNames,
        defaultClassId,
        existingAdmissions
      );

      const toInsert = validated.filter((r) => r.status !== "error");
      const skipped = validated.filter((r) => r.status === "error");

      type InsertRow = Database["public"]["Tables"]["students"]["Insert"];
      const successLines: number[] = [];
      const warningImports: { line: number; warnings: string[] }[] = [];
      const insertErrors: { line: number; message: string }[] = [];
      const admissionsAfterInsert = new Set(existingAdmissions);

      for (const r of toInsert) {
        if (!r.resolved_class_id) {
          insertErrors.push({
            line: r.line,
            message: "Missing class assignment.",
          });
          continue;
        }

        if (r.admission_number != null) {
          const k = r.admission_number.toLowerCase();
          if (admissionsAfterInsert.has(k)) {
            insertErrors.push({
              line: r.line,
              message: "Duplicate admission number (database).",
            });
            continue;
          }
        }

        const row: InsertRow = {
          school_id: schoolId,
          class_id: r.resolved_class_id,
          full_name: r.full_name,
          admission_number: r.admission_number,
          parent_email: r.parent_email,
          parent_name: null,
          parent_phone: null,
        };

        const { error: insErr } = await supabase.from("students").insert(row as never);

        if (insErr) {
          if (insErr.code === "23505") {
            insertErrors.push({
              line: r.line,
              message: "Duplicate admission number (database).",
            });
          } else {
            insertErrors.push({ line: r.line, message: insErr.message });
          }
          continue;
        }

        if (r.admission_number != null) {
          admissionsAfterInsert.add(r.admission_number.toLowerCase());
        }
        successLines.push(r.line);
        if (r.warnings.length > 0) {
          warningImports.push({ line: r.line, warnings: [...r.warnings] });
        }
      }

      const skippedWithReasons = [
        ...skipped.map((r) => ({
          line: r.line,
          reasons: r.errors,
        })),
        ...insertErrors.map((e) => ({
          line: e.line,
          reasons: [e.message],
        })),
      ];

      if (successLines.length > 0) {
        revalidatePath("/dashboard/students");
      }

      return NextResponse.json({
        imported: successLines.length,
        importedWithWarnings: warningImports,
        skipped: skippedWithReasons.length,
        skippedDetails: skippedWithReasons,
        successLines,
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
