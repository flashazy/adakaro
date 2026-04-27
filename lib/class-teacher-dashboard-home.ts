import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ClassTeacherHomeRecentMessage = {
  messageId: string;
  conversationId: string;
  parentId: string;
  parentName: string;
  /** One line for deep link / display (first student if several). */
  primaryStudentName: string;
  /** All linked student names in this class for this parent. */
  studentNamesDisplay: string;
  messagePreview: string;
  createdAt: string;
};

export type ClassTeacherHomeSummary = {
  activeStudentCount: number;
  linkedParentCount: number;
  unreadMessageCount: number;
  recentFromParents: ClassTeacherHomeRecentMessage[];
};

export type ClassTeacherAcademicBanner = {
  yearLabel: string;
  termLabel: string | null;
};

function dayInclusive(d: Date, isoStart: string | null, isoEnd: string | null): boolean {
  if (!isoStart?.trim() || !isoEnd?.trim()) return false;
  const t = d.getTime();
  const s = new Date(`${isoStart}T12:00:00`).getTime();
  const e = new Date(`${isoEnd}T12:00:00`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return false;
  return t >= s && t <= e;
}

function inferTermLabel(
  today: Date,
  termStructure: "2_terms" | "3_terms" | null | undefined,
  row: {
    term_1_start: string | null;
    term_1_end: string | null;
    term_2_start: string | null;
    term_2_end: string | null;
    term_3_start: string | null;
    term_3_end: string | null;
  }
): string | null {
  if (dayInclusive(today, row.term_1_start, row.term_1_end)) return "Term 1";
  if (dayInclusive(today, row.term_2_start, row.term_2_end)) return "Term 2";
  if (termStructure === "3_terms" && dayInclusive(today, row.term_3_start, row.term_3_end)) {
    return "Term 3";
  }
  return null;
}

/**
 * Academic year + current term label from school settings (best effort).
 */
export async function loadAcademicBannerForClass(
  classId: string
): Promise<ClassTeacherAcademicBanner> {
  const fallbackYear = String(new Date().getFullYear());
  try {
    const admin = createAdminClient();
    const { data: cls, error: cErr } = await admin
      .from("classes")
      .select("school_id")
      .eq("id", classId)
      .maybeSingle();
    if (cErr || !cls) {
      return { yearLabel: fallbackYear, termLabel: null };
    }
    const schoolId = (cls as { school_id: string }).school_id;
    const { data: school, error: sErr } = await admin
      .from("schools")
      .select(
        "current_academic_year, term_structure, term_1_start, term_1_end, term_2_start, term_2_end, term_3_start, term_3_end"
      )
      .eq("id", schoolId)
      .maybeSingle();
    if (sErr || !school) {
      return { yearLabel: fallbackYear, termLabel: null };
    }
    const s = school as {
      current_academic_year: string | null;
      term_structure: "2_terms" | "3_terms" | null;
      term_1_start: string | null;
      term_1_end: string | null;
      term_2_start: string | null;
      term_2_end: string | null;
      term_3_start: string | null;
      term_3_end: string | null;
    };
    const yearLabel =
      s.current_academic_year?.trim() || fallbackYear;
    const termLabel = inferTermLabel(new Date(), s.term_structure, s);
    return { yearLabel, termLabel };
  } catch {
    return { yearLabel: fallbackYear, termLabel: null };
  }
}

function previewMessage(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Summary stats + latest parent-authored messages for one class (service role).
 */
export async function loadClassTeacherHomeSummary(
  teacherId: string,
  classId: string
): Promise<ClassTeacherHomeSummary> {
  const empty: ClassTeacherHomeSummary = {
    activeStudentCount: 0,
    linkedParentCount: 0,
    unreadMessageCount: 0,
    recentFromParents: [],
  };
  try {
    const admin = createAdminClient();

    const { count: studCount, error: scErr } = await admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("status", "active");
    if (scErr) return empty;
    const activeStudentCount = studCount ?? 0;

    const { data: studs, error: stErr } = await admin
      .from("students")
      .select("id")
      .eq("class_id", classId)
      .eq("status", "active");
    if (stErr) {
      return { ...empty, activeStudentCount };
    }
    if (!studs?.length) {
      return {
        ...empty,
        activeStudentCount,
      };
    }
    const studentIds = (studs as { id: string }[]).map((s) => s.id);
    const { data: links } = await admin
      .from("parent_students")
      .select("parent_id")
      .in("student_id", studentIds);
    const linkedParentCount = new Set(
      ((links ?? []) as { parent_id: string }[]).map((l) => l.parent_id)
    ).size;

    const { data: convs } = await admin
      .from("chat_conversations")
      .select("id, parent_id")
      .eq("class_teacher_id", teacherId)
      .eq("class_id", classId);
    const convList = (convs ?? []) as { id: string; parent_id: string }[];
    const convIds = convList.map((c) => c.id);
    const parentByConv = new Map(convList.map((c) => [c.id, c.parent_id]));

    let unreadMessageCount = 0;
    if (convIds.length > 0) {
      const { count: unread } = await admin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .eq("is_read", false)
        .neq("sender_id", teacherId);
      unreadMessageCount = unread ?? 0;
    }

    let recentFromParents: ClassTeacherHomeRecentMessage[] = [];
    if (convIds.length > 0) {
      const { data: msgs, error: mErr } = await admin
        .from("chat_messages")
        .select("id, message, created_at, sender_id, conversation_id")
        .in("conversation_id", convIds)
        .neq("sender_id", teacherId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (!mErr && msgs?.length) {
        const parentMsgs = (msgs as {
          id: string;
          message: string;
          created_at: string;
          sender_id: string;
          conversation_id: string;
        }[]).filter((m) => parentByConv.get(m.conversation_id) === m.sender_id);

        const top10 = parentMsgs.slice(0, 10);

        const parentIds = [...new Set(top10.map((m) => m.sender_id))];
        const nameByParent = new Map<string, string>();
        if (parentIds.length > 0) {
          const { data: profs } = await admin
            .from("profiles")
            .select("id, full_name")
            .in("id", parentIds);
          for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
            nameByParent.set(p.id, p.full_name?.trim() || "Parent");
          }
        }

        const studentIdsByParent = new Map<string, string[]>();
        if (parentIds.length > 0) {
          const { data: linkRows } = await admin
            .from("parent_students")
            .select("parent_id, student_id")
            .in("parent_id", parentIds)
            .in("student_id", studentIds);
          for (const l of (linkRows ?? []) as {
            parent_id: string;
            student_id: string;
          }[]) {
            const arr = studentIdsByParent.get(l.parent_id) ?? [];
            arr.push(l.student_id);
            studentIdsByParent.set(l.parent_id, arr);
          }
        }

        const allStudentIds = [
          ...new Set(
            [...studentIdsByParent.values()].flat().filter(Boolean)
          ),
        ];
        const nameByStudentId = new Map<string, string>();
        if (allStudentIds.length > 0) {
          const { data: snames } = await admin
            .from("students")
            .select("id, full_name")
            .in("id", allStudentIds)
            .order("full_name");
          for (const r of (snames ?? []) as {
            id: string;
            full_name: string;
          }[]) {
            nameByStudentId.set(r.id, r.full_name?.trim() || "Student");
          }
        }

        for (const m of top10) {
          const parentId = m.sender_id;
          const sids = studentIdsByParent.get(parentId) ?? [];
          const names = sids
            .map((id) => nameByStudentId.get(id))
            .filter((x): x is string => Boolean(x?.trim()));
          const studentNamesDisplay =
            names.length > 0 ? names.join(", ") : "Student";
          const primaryStudentName = names[0] ?? "Student";

          recentFromParents.push({
            messageId: m.id,
            conversationId: m.conversation_id,
            parentId,
            parentName: nameByParent.get(parentId) ?? "Parent",
            primaryStudentName,
            studentNamesDisplay,
            messagePreview: previewMessage(m.message),
            createdAt: m.created_at,
          });
        }
      }
    }

    return {
      activeStudentCount,
      linkedParentCount,
      unreadMessageCount,
      recentFromParents,
    };
  } catch {
    return empty;
  }
}
