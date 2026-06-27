import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPageNumbers,
  KNOWLEDGE_DEFAULT_PAGE_SIZE,
} from "@/components/super-admin/ai-training/knowledge-pagination";

describe("KnowledgePagination helpers", () => {
  it("defaults to 25 rows per page", () => {
    assert.equal(KNOWLEDGE_DEFAULT_PAGE_SIZE, 25);
  });

  it("builds all page numbers when total pages <= 7", () => {
    assert.deepEqual(buildPageNumbers(1, 5), [1, 2, 3, 4, 5]);
  });

  it("builds ellipsis page numbers for large totals", () => {
    const pages = buildPageNumbers(10, 40);
    assert.equal(pages[0], 1);
    assert.equal(pages[pages.length - 1], 40);
    assert.ok(pages.includes("ellipsis"));
    assert.ok(pages.includes(10));
  });
});
