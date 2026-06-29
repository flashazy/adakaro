"use client";

import { useCallback, useEffect, useState } from "react";
import type { KnowledgeIntelligenceSnapshot } from "@/lib/ai-training/knowledge-intelligence-types";

export function useIntelligenceSnapshot(external?: KnowledgeIntelligenceSnapshot | null) {
  const [snapshot, setSnapshot] = useState<KnowledgeIntelligenceSnapshot | null>(external ?? null);
  const [loading, setLoading] = useState(!external);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ai-training/intelligence");
      if (!res.ok) throw new Error("Failed to load intelligence");
      const data = (await res.json()) as { snapshot?: KnowledgeIntelligenceSnapshot };
      setSnapshot(data.snapshot ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (external) {
      setSnapshot(external);
      setLoading(false);
      return;
    }
    void reload();
  }, [external, reload]);

  return { snapshot, loading, error, reload };
}
