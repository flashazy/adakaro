"use client";

import { useEffect } from "react";
import { schoolSettingsVisitedKey } from "@/lib/dashboard/school-setup-onboarding";

/** Records a one-time school settings visit in localStorage (UI hint only). */
export function SchoolSettingsVisitMarker({ schoolId }: { schoolId: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(schoolSettingsVisitedKey(schoolId), "1");
    } catch {
      // Ignore private browsing / storage quota errors.
    }
  }, [schoolId]);

  return null;
}
