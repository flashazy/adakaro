import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareKnowledgeEntities,
  extractKnowledgeEntity,
} from "@/lib/ai-training/knowledge-entities";
import { migrateKnowledgeCategory } from "@/lib/ai-training/knowledge-categories";

describe("knowledge entities", () => {
  it("distinguishes Adakaro from Adakaro AI", () => {
    const platform = extractKnowledgeEntity("What is Adakaro?");
    const ai = extractKnowledgeEntity("Who is Adakaro AI?");
    assert.ok(platform);
    assert.ok(ai);
    assert.equal(platform.id, "adakaro");
    assert.equal(ai.id, "adakaro-ai");
    assert.ok(compareKnowledgeEntities(platform, ai) < 0.2);
  });

  it("recognizes module entities", () => {
    assert.equal(extractKnowledgeEntity("What is Student Streaming?")?.id, "student-streaming");
    assert.equal(extractKnowledgeEntity("What is Report Cards?")?.id, "report-cards");
    assert.equal(extractKnowledgeEntity("What is Student Management?")?.id, "student-management");
  });

  it("keeps taxonomy categories intact", () => {
    assert.equal(migrateKnowledgeCategory("General"), "General");
    assert.equal(migrateKnowledgeCategory("Support"), "Technical Support");
  });
});
