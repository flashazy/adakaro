import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeDocumentation } from "@/lib/ai-author/composition-writer";
import {
  classifyFact,
  clusterFacts,
  collectAudienceRoles,
} from "@/lib/ai-author/fact-cluster";
import type { ScoredFact } from "@/lib/ai-author/types";

function fact(overrides: Partial<ScoredFact> & { text: string }): ScoredFact {
  const text = overrides.text;
  return {
    id: overrides.id ?? `f:${text.slice(0, 12)}`,
    text,
    normalizedText: text.toLowerCase(),
    sourceEntryId: "1",
    sourceQuestion: "What is Adakaro?",
    sectionHint: overrides.sectionHint ?? null,
    tokens: text.toLowerCase().split(/\s+/).filter((t) => t.length > 2),
    relevanceScore: overrides.relevanceScore ?? 80,
    intentScore: 80,
    topicScore: 80,
    ...overrides,
  };
}

describe("fact-cluster", () => {
  it("classifies audience roles separately from capabilities", () => {
    assert.equal(classifyFact(fact({ text: "Teachers" })), "audience");
    assert.equal(classifyFact(fact({ text: "Teachers manage classes." })), "capabilities");
    assert.equal(classifyFact(fact({ text: "Adakaro includes finance and attendance." })), "capabilities");
  });

  it("classifies benefits as outcomes not features", () => {
    assert.equal(
      classifyFact(fact({ text: "Centralizes school operations and saves administrative time." })),
      "benefits"
    );
    assert.equal(
      classifyFact(fact({ text: "The AI assistant can answer questions about Adakaro." })),
      "capabilities"
    );
  });

  it("classifies identity and purpose separately", () => {
    assert.equal(
      classifyFact(fact({ text: "Adakaro is a cloud-based school management platform." })),
      "identity"
    );
    assert.equal(
      classifyFact(fact({ text: "Adakaro helps schools simplify daily operations." })),
      "purpose"
    );
  });

  it("merges cloud-based and online identity facts in composition", () => {
    const composed = composeDocumentation({
      facts: [
        fact({ id: "1", text: "Adakaro is cloud-based." }),
        fact({ id: "2", text: "Adakaro runs online." }),
      ],
      expectedAnswerType: "definition",
      intent: "identity",
    });

    assert.match(composed.draft, /cloud-based.*online/i);
    assert.equal(composed.sections.filter((s) => s.title === "Overview").length, 1);
  });
});

describe("composition-writer", () => {
  it("composes enterprise documentation with correct section placement", () => {
    const composed = composeDocumentation({
      facts: [
        fact({ text: "Adakaro is a cloud-based school management platform." }),
        fact({ text: "Adakaro helps schools manage daily operations from one secure platform." }),
        fact({ text: "Built for schools and administrators." }),
        fact({ text: "Teachers manage classes." }),
        fact({ text: "Parents use the portal." }),
        fact({ text: "Adakaro includes finance and attendance." }),
        fact({ text: "Adakaro has an AI assistant." }),
      ],
      expectedAnswerType: "audience",
      intent: "identity",
    });

    assert.match(composed.draft, /Overview\n\n/);
    assert.match(composed.draft, /Purpose\n\n/);
    assert.match(composed.draft, /Suitable for\n\n/);
    assert.match(composed.draft, /Key capabilities\n\n/);

    const suitable = composed.sections.find((s) => s.title === "Suitable for")?.content ?? "";
    assert.match(suitable, /Teachers/);
    assert.match(suitable, /Parents/);
    assert.doesNotMatch(suitable, /finance/i);

    const capabilities =
      composed.sections.find((s) => s.title === "Key capabilities")?.content ?? "";
    assert.match(capabilities, /finance/i);
    assert.match(capabilities, /AI assistant/i);
    assert.doesNotMatch(capabilities, /Teachers manage classes/i);

    const benefits = composed.sections.find((s) => s.title === "Benefits")?.content ?? "";
    assert.doesNotMatch(benefits, /Teachers/);
    assert.equal(composed.issues.length, 0);
  });

  it("collects audience roles from mixed facts", () => {
    const roles = collectAudienceRoles([
      fact({ text: "Teachers manage classes." }),
      fact({ text: "Parents use the portal." }),
      fact({ text: "Built for schools and administrators." }),
    ]);
    assert.ok(roles.includes("Teachers"));
    assert.ok(roles.includes("Parents"));
    assert.ok(roles.some((r) => /administrator/i.test(r)));
  });

  it("clusters facts by semantic meaning not extraction order", () => {
    const clusters = clusterFacts([
      fact({ id: "1", text: "Adakaro includes finance and attendance." }),
      fact({ id: "2", text: "Adakaro is a cloud-based school management platform." }),
      fact({ id: "3", text: "Teachers manage classes." }),
    ]);

    assert.ok((clusters.get("identity") ?? []).some((f) => f.id === "2"));
    assert.ok((clusters.get("capabilities") ?? []).some((f) => f.id === "1"));
    assert.ok((clusters.get("capabilities") ?? []).some((f) => f.id === "3"));
  });
});
