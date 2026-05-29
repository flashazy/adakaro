import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichClassesWithNext } from "@/lib/promotions/resolve-next-class";
import type { PromotionClassRow } from "@/lib/promotions/types";
import type { Database } from "@/types/supabase";

export interface PromotionsPageSetupClass {
  id: string;
  name: string;
  track_id: string | null;
  progression_order: number | null;
  parent_class_id: string | null;
}

export interface PromotionsPageData {
  tracks: { id: string; track_name: string }[];
  classes: PromotionClassRow[];
  setupClasses: PromotionsPageSetupClass[];
}

/** Single loader for /dashboard/promotions (admin and academic entry points). */
export async function loadPromotionsPageData(
  db: SupabaseClient<Database>,
  schoolId: string
): Promise<PromotionsPageData> {
  const [{ data: tracks }, { data: classes }, { data: students }] =
    await Promise.all([
      db
        .from("class_progression_tracks")
        .select("id, track_name")
        .eq("school_id", schoolId)
        .order("track_name"),
      db
        .from("classes")
        .select("id, name, track_id, progression_order, parent_class_id")
        .eq("school_id", schoolId)
        .order("name"),
      db
        .from("students")
        .select("id, class_id")
        .eq("school_id", schoolId)
        .eq("status", "active")
        .eq("approval_status", "approved"),
    ]);

  const trackNameById = new Map(
    ((tracks ?? []) as { id: string; track_name: string }[]).map((t) => [
      t.id,
      t.track_name,
    ] as const)
  );

  const countByClass = new Map<string, number>();
  for (const s of (students ?? []) as { id: string; class_id: string }[]) {
    countByClass.set(s.class_id, (countByClass.get(s.class_id) ?? 0) + 1);
  }

  const classRows = (classes ?? []) as {
    id: string;
    name: string;
    track_id: string | null;
    progression_order: number | null;
    parent_class_id: string | null;
  }[];

  const enriched = enrichClassesWithNext(
    classRows.map((c) => ({
      id: c.id,
      name: c.name,
      track_id: c.track_id,
      progression_order: c.progression_order,
    }))
  );

  const promotionClasses = enriched
    .filter((c) => {
      const raw = classRows.find((r) => r.id === c.id);
      return !raw?.parent_class_id;
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      track_id: c.track_id,
      track_name: c.track_id ? trackNameById.get(c.track_id) ?? null : null,
      progression_order: c.progression_order,
      student_count: countByClass.get(c.id) ?? 0,
      next_class_id: c.next_class_id,
      next_class_name: c.next_class_name,
    }))
    .sort((a, b) => {
      const ta = a.track_name ?? "zzz";
      const tb = b.track_name ?? "zzz";
      if (ta !== tb) return ta.localeCompare(tb);
      const oa = a.progression_order ?? 9999;
      const ob = b.progression_order ?? 9999;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });

  const setupClasses = classRows.map((c) => ({
    id: c.id,
    name: c.name,
    track_id: c.track_id,
    progression_order: c.progression_order,
    parent_class_id: c.parent_class_id,
  }));

  return {
    tracks: (tracks ?? []) as { id: string; track_name: string }[],
    classes: promotionClasses,
    setupClasses,
  };
}
