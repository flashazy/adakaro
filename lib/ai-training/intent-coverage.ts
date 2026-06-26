import { INTENT_REGISTRY } from "./intent-registry";
import { resolveEntryIntent } from "./intent-registry";
import type { AIKnowledgeEntry, IntentCoverageSummary } from "./types";

const WEAK_ENTRY_THRESHOLD = 2;

export function computeIntentCoverage(
  entries: AIKnowledgeEntry[]
): IntentCoverageSummary {
  const activeEntries = entries.filter((e) => e.status === "active");
  const intentEntryCounts = new Map<string, number>();

  for (const entry of activeEntries) {
    const intent = resolveEntryIntent(entry);
    if (!intent.intent_key) continue;
    intentEntryCounts.set(
      intent.intent_key,
      (intentEntryCounts.get(intent.intent_key) ?? 0) + 1
    );
  }

  const intents = INTENT_REGISTRY.map((def) => {
    const entryCount = intentEntryCounts.get(def.key) ?? 0;
    let status: "covered" | "missing" | "weak" = "missing";
    if (entryCount >= WEAK_ENTRY_THRESHOLD) status = "covered";
    else if (entryCount > 0) status = "weak";

    return {
      key: def.key,
      name: def.name,
      group: def.group,
      entryCount,
      status,
    };
  });

  const coveredIntents = intents.filter((i) => i.status === "covered").length;
  const missingIntents = intents.filter((i) => i.status === "missing").length;
  const weakIntents = intents.filter((i) => i.status === "weak").length;

  const groupMissing = new Map<string, number>();
  for (const intent of intents) {
    if (intent.status === "missing") {
      groupMissing.set(
        intent.group,
        (groupMissing.get(intent.group) ?? 0) + 1
      );
    }
  }

  const categoriesNeedingTraining = [...groupMissing.entries()]
    .map(([group, missingCount]) => ({ group, missingCount }))
    .sort((a, b) => b.missingCount - a.missingCount);

  return {
    totalIntents: INTENT_REGISTRY.length,
    coveredIntents,
    missingIntents,
    weakIntents,
    intents,
    categoriesNeedingTraining,
  };
}
