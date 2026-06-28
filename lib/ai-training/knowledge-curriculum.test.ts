import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCurriculumDashboard,
  CURRICULUM_MODULES,
  resolveEntryModuleId,
  resolveLessonStatus,
} from "@/lib/ai-training/knowledge-curriculum";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function entry(
  overrides: Partial<AIKnowledgeEntry> & Pick<AIKnowledgeEntry, "id" | "question">
): AIKnowledgeEntry {
  return {
    category: "General",
    keywords: ["adakaro", "school", "platform"],
    search_phrases: ["what is adakaro"],
    alternative_wording: ["tell me about adakaro"],
    synonyms: ["sms"],
    related_terms: ["school management"],
    answer:
      "**Overview**\n\nAdakaro is a school management platform.\n\n**Core Facts**\n\n- Enrollment\n- Attendance",
    priority: "normal",
    usage_count: 1,
    last_used_at: null,
    status: "active",
    created_by: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-02T00:00:00Z",
    is_primary: true,
    version_number: 1,
    health_status: "healthy",
    intent_key: "what_is_adakaro",
    ...overrides,
  };
}

describe("knowledge curriculum", () => {
  it("defines 18 default modules", () => {
    assert.equal(CURRICULUM_MODULES.length, 18);
  });

  it("maps categories to curriculum modules", () => {
    assert.equal(resolveEntryModuleId(entry({ id: "1", question: "Q", category: "Finance" })), "finance");
    assert.equal(
      resolveEntryModuleId(entry({ id: "2", question: "Q", category: "General", curriculum_module: "ai-copilot" })),
      "ai-copilot"
    );
  });

  it("builds dashboard summary from knowledge entries", () => {
    const dashboard = buildCurriculumDashboard(
      [
        entry({ id: "1", question: "What is Adakaro?" }),
        entry({ id: "2", question: "How much?", category: "Pricing" }),
      ],
      { knowledgeTarget: 2500 }
    );
    assert.equal(dashboard.summary.totalEntries, 2);
    assert.equal(dashboard.summary.knowledgeTarget, 2500);
    assert.ok(dashboard.modules.length === 18);
    assert.ok(dashboard.summary.overallCompletionPercent >= 0);
  });

  it("resolves lesson status from entry metadata", () => {
    assert.equal(resolveLessonStatus(entry({ id: "1", question: "Q" })), "published");
    assert.equal(
      resolveLessonStatus(entry({ id: "2", question: "Q", health_status: "needs_review" })),
      "needs_review"
    );
  });
});
