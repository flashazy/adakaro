"use client";

import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { formatDateTime } from "@/components/super-admin/ai-training/shared";
import {
  EmptyStateInsight,
  GlassPanel,
  OPS_GRID,
  OPS_STACK,
  OperationsSkeleton,
  PageAIInsight,
} from "@/components/super-admin/ai-training/operations/operations-premium-ui";
import { useIntelligenceSnapshot } from "@/components/super-admin/ai-training/operations/use-intelligence-snapshot";
import type { KnowledgeIntelligenceSnapshot, KnowledgeMemoryItem } from "@/lib/ai-training/knowledge-intelligence-types";
import { KNOWLEDGE_STRENGTH_LABELS } from "@/lib/ai-training/knowledge-intelligence-types";
import { buildPageInsight, groupMemoryItems, MEMORY_GROUP_LABELS } from "@/lib/ai-training/operations-presentation";
import { cn } from "@/lib/utils";

export function KnowledgeMemoryPanel({
  snapshot: external,
}: {
  snapshot?: KnowledgeIntelligenceSnapshot | null;
}) {
  const { snapshot } = useIntelligenceSnapshot(external);
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

  if (loading) return <OperationsSkeleton rows={2} />;

  const orgGroups = groupMemoryItems(memory);
  const learnedGroups = groupMemoryItems(inferred);
  const total = memory.length + inferred.length;
  const insight = snapshot ? buildPageInsight("memory", snapshot) : "";

  return (
    <div className={OPS_STACK}>
      {insight ? <PageAIInsight message={insight} context="memory" /> : null}

      <GlassPanel gradient="violet" compact>
        <div className="flex items-center gap-2.5">
          <Brain className="h-5 w-5 text-violet-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">AI Memory</h3>
            <p className="text-[11px] text-slate-500">
              {total > 0
                ? `${total} memory items — terminology, style, and reviewer decisions`
                : "Long-term organizational intelligence forming"}
            </p>
          </div>
        </div>
      </GlassPanel>

      <div className={cn("grid", OPS_GRID, "lg:grid-cols-2")}>
        <MemoryColumn title="Organizational memory" subtitle="Brand, terminology, and established facts" groups={orgGroups} />
        <MemoryColumn title="Recently learned" subtitle="Patterns from usage and review" groups={learnedGroups} />
      </div>
    </div>
  );
}

function MemoryColumn({
  title,
  subtitle,
  groups,
}: {
  title: string;
  subtitle: string;
  groups: Array<{ group: string; items: KnowledgeMemoryItem[] }>;
}) {
  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        <p className="text-[10px] text-slate-500">{subtitle}</p>
      </div>
      {groups.length === 0 ? (
        <EmptyStateInsight kind="memory" />
      ) : (
        groups.map(({ group, items }) => (
          <GlassPanel key={group} compact>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">{group}</p>
            <ul className="mt-2 space-y-2">
              {items.map((item) => (
                <MemoryItemCard key={item.id} item={item} />
              ))}
            </ul>
          </GlassPanel>
        ))
      )}
    </div>
  );
}

function MemoryItemCard({ item }: { item: KnowledgeMemoryItem }) {
  return (
    <li className="rounded-lg border border-slate-200/80 bg-white/60 px-3 py-2 transition-all duration-200 hover:border-violet-200 hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-700">
          {MEMORY_GROUP_LABELS[item.category]?.split(" ")[0] ?? item.category}
        </span>
        <span className="text-xs font-semibold text-slate-800">{item.key}</span>
        <span className="ml-auto rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
          {item.confidence}%
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-700">{item.value}</p>
      <dl className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-1.5 text-[9px] text-slate-500">
        <div>
          <dt className="font-semibold uppercase">Learned</dt>
          <dd>{formatDateTime(item.updatedAt)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase">Source</dt>
          <dd>{item.source}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase">Used</dt>
          <dd>{item.usageCount}× matched</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase">Why stored</dt>
          <dd>Organizational consistency</dd>
        </div>
      </dl>
    </li>
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
