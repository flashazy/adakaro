"use client";

import { useEffect, useState } from "react";
import type { SchoolIntelligenceContextPayload } from "@/lib/super-admin/smart-intelligence-navigation";

export function useSchoolIntelligenceContext(schoolId: string | null) {
  const [data, setData] = useState<SchoolIntelligenceContextPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/super-admin/schools/${encodeURIComponent(schoolId)}/intelligence-context`,
          { credentials: "same-origin" }
        );
        const body = (await res.json().catch(() => ({}))) as
          | SchoolIntelligenceContextPayload
          | { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setData(null);
          setError(
            "error" in body && body.error
              ? body.error
              : "Could not load school context."
          );
          return;
        }
        setData(body as SchoolIntelligenceContextPayload);
      } catch {
        if (!cancelled) {
          setData(null);
          setError("Could not load school context.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  return { data, loading, error };
}
