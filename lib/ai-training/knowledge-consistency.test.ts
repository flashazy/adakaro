import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupValidationIssues } from "@/lib/ai-training/collect-validation-issues";
import { computeKnowledgeHealth } from "@/lib/ai-training/knowledge-duplicates";
import { resolveDisplayHealth } from "@/lib/ai-training/normalize-knowledge-entry";
import type { ValidationIssue } from "@/lib/ai-training/knowledge-validation-locations";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

function issue(ruleId: string, field: string, original: string): ValidationIssue {
  return {
    id: `${ruleId}-${original}`,
    ruleId,
    ruleLabel: ruleId,
    location: {
      section: "Metadata",
      field,
      paragraphIndex: 0,
      sentenceIndex: 0,
      charStart: 0,
      charEnd: original.length,
    },
    original,
    suggestion: original.toLowerCase(),
    reason: "test",
    fixable: true,
  };
}

describe("knowledge consistency", () => {
  it("groups repeated metadata issues", () => {
    const grouped = groupValidationIssues([
      issue("metadata-search_phrases", "search_phrases", "Finance Module"),
      issue("metadata-search_phrases", "search_phrases", "Student Portal"),
      issue("metadata-search_phrases", "search_phrases", "Fee Report"),
    ]);

    assert.equal(grouped.length, 1);
    assert.equal(grouped[0]!.count, 3);
    assert.ok(grouped[0]!.summary.includes("Search phrases"));
  });

  it("marks excellent entries healthy for display and compute", () => {
    const entry: AIKnowledgeEntry = {
      id: "1",
      category: "General",
      question: "What is Adakaro?",
      answer:
        "**Overview**\nAdakaro is a school management platform that helps schools run enrollment, attendance, academics, and parent communication in one place.\n\n**Core Facts**\n- Enrollment and student records\n- Daily attendance tracking\n- Report cards and academic results\n- Parent portal and notifications",
      keywords: [
        "adakaro",
        "school management",
        "platform",
        "enrollment",
        "attendance",
        "report cards",
      ],
      search_phrases: [
        "what is adakaro",
        "adakaro school software",
        "adakaro platform overview",
      ],
      alternative_wording: ["Tell me about Adakaro?", "What does Adakaro do?"],
      synonyms: ["school software", "education platform", "school system"],
      related_terms: [
        "School Management System",
        "Student Information System",
        "Education Technology",
      ],
      priority: "normal",
      usage_count: 10,
      last_used_at: null,
      status: "active",
      created_by: null,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
      health_status: "needs_review",
    };

    assert.equal(resolveDisplayHealth(entry), "healthy");
    assert.equal(computeKnowledgeHealth(entry, [entry]).level, "healthy");
  });
});
