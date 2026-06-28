"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import { saSection, saSectionSubtitle, saSectionTitle } from "@/components/super-admin/super-admin-dashboard-ui";
import type { KnowledgeMemoryItem } from "@/lib/ai-training/knowledge-intelligence-types";
import { KNOWLEDGE_STRENGTH_LABELS } from "@/lib/ai-training/knowledge-intelligence-types";
import { cn } from "@/lib/utils";

export function KnowledgeMemoryPanel() {
  const [memory, setMemory] = useState<KnowledgeMemoryItem[]>([]);
  const [inferred, setInferred] = useState<KnowledgeMemoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/super-admin/ai-training/intelligence/memory")
      .then((r) => r.json())
      .then((d: { memory?: KnowledgeMemoryItem[]; inferred?: KnowledgeMemoryItem[] }) => {
        setMemory(d.memory ?? []);
        setInferred(d.inferred ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={cn(saSection, "flex justify-center py-12")}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={saSection}>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-600" />
          <h3 className={saSectionTitle}>AI Memory</h3>
        </div>
        <p className={saSectionSubtitle}>
          Long-term organizational memory — terminology, brand language, and reviewer preferences
        </p>
      </div>

      <MemorySection title="Organizational memory" items={memory} />
      <MemorySection title="Learned from usage" items={inferred} />
    </div>
  );
}

function MemorySection({ title, items }: { title: string; items: KnowledgeMemoryItem[] }) {
  return (
    <div className={cn(saSection, "bg-white")}>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
                {item.category.replace(/_/g, " ")}
              </span>
              <span className="text-xs font-semibold text-slate-800">{item.key}</span>
              <span className="ml-auto text-xs text-emerald-700">{item.confidence}% confidence</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{item.value}</p>
            <p className="mt-1 text-[10px] text-slate-400">Source: {item.source}</p>
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm text-slate-400">No items yet</li> : null}
      </ul>
    </div>
  );
}

export function KnowledgeStrengthBadge({ level }: { level: keyof typeof KNOWLEDGE_STRENGTH_LABELS }) {
  const tones: Record<string, string> = {
    core: "bg-red-100 text-red-800",
    essential: "bg-orange-100 text-orange-800",
    advanced: "bg-indigo-100 text-indigo-800",
    reference: "bg-sky-100 text-sky-800",
    optional: "bg-slate-100 text-slate-700",
    legacy: "bg-slate-200 text-slate-500",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", tones[level])}>
      {KNOWLEDGE_STRENGTH_LABELS[level]}
    </span>
  );
}
