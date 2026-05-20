"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { assertCanViewDutyBook } from "@/lib/duty-book/duty-book-access";
import { loadDutyBookData } from "@/lib/duty-book/load-duty-book-data";
import type { DutyBookPayload } from "@/lib/duty-book/types";

export async function loadDutyBookDataAction(
  date: string
): Promise<{ ok: true; data: DutyBookPayload } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  const gate = await assertCanViewDutyBook(supabase, schoolId);
  if (!gate.ok) return gate;

  const { data: schoolRow } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName =
    (schoolRow as { name: string } | null)?.name?.trim() || "School";

  const admin = createAdminClient();
  return loadDutyBookData(admin, schoolId, schoolName, date);
}
