import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGroupedCategoryList,
  filterGroupedCategoryList,
  getCategoryGroupLabel,
  getSortedKnowledgeCategories,
  isKnownKnowledgeCategory,
  KNOWLEDGE_CATEGORY_GROUPS,
  KNOWLEDGE_CATEGORY_TAXONOMY,
  migrateKnowledgeCategory,
} from "@/lib/ai-training/knowledge-categories";

describe("knowledge categories", () => {
  it("defines 29 enterprise categories", () => {
    assert.equal(KNOWLEDGE_CATEGORY_TAXONOMY.length, 29);
  });

  it("groups all categories without gaps", () => {
    const grouped = KNOWLEDGE_CATEGORY_GROUPS.flatMap((g) => g.categories);
    assert.equal(grouped.length, 29);
    assert.deepEqual([...new Set(grouped)].sort(), [...KNOWLEDGE_CATEGORY_TAXONOMY].sort());
  });

  it("sorts categories alphabetically", () => {
    const sorted = getSortedKnowledgeCategories();
    assert.deepEqual(sorted, [...sorted].sort((a, b) => a.localeCompare(b)));
    assert.equal(sorted[0], "About Adakaro");
  });

  it("maps categories to groups", () => {
    assert.equal(getCategoryGroupLabel("AI Copilot"), "Platform");
    assert.equal(getCategoryGroupLabel("Admissions"), "Student Lifecycle");
    assert.equal(getCategoryGroupLabel("Technical Support"), "Help Center");
  });

  it("filters grouped list by group name", () => {
    const items = buildGroupedCategoryList();
    const filtered = filterGroupedCategoryList(items, "platform");
    assert.ok(filtered.some((i) => i.type === "header" && i.label === "Platform"));
    assert.ok(filtered.some((i) => i.type === "option" && i.value === "AI Copilot"));
  });

  it("migrates legacy labels", () => {
    assert.equal(migrateKnowledgeCategory("Support"), "Technical Support");
    assert.equal(migrateKnowledgeCategory("Syllabus"), "Curriculum & Syllabus");
    assert.equal(migrateKnowledgeCategory("Onboarding"), "Getting Started");
    assert.equal(migrateKnowledgeCategory("General"), "General");
  });

  it("preserves unknown categories", () => {
    assert.equal(migrateKnowledgeCategory("Custom Legacy"), "Custom Legacy");
  });

  it("recognizes canonical categories", () => {
    assert.equal(isKnownKnowledgeCategory("Finance"), true);
    assert.equal(isKnownKnowledgeCategory("Support"), false);
  });
});
