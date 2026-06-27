import { NextRequest, NextResponse } from "next/server";
import { syncKnowledgeEntryEmbeddingSafe } from "@/lib/ai-training/embeddings";
import { generateKeywordsFromQuestion } from "@/lib/ai-training/keyword-generator";
import {
  createKnowledgeEntry,
  type KnowledgeEntryPayload,
} from "@/lib/ai-training/knowledge-entry-mutations";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type { AIKnowledgeEntry, KnowledgePriority } from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

interface BulkEntryInput {
  question: string;
  answer: string;
  category?: string;
  priority?: KnowledgePriority;
}

function parseBulkText(text: string): BulkEntryInput[] {
  const entries: BulkEntryInput[] = [];
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  for (const block of blocks) {
    const qMatch = block.match(/^Q:\s*(.+?)(?:\nA:\s*([\s\S]+))?$/im);
    if (qMatch) {
      const question = qMatch[1]?.trim();
      const answer = qMatch[2]?.trim();
      if (question && answer) entries.push({ question, answer });
      continue;
    }

    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && !lines[0]!.includes(",")) {
      entries.push({ question: lines[0]!, answer: lines.slice(1).join("\n") });
      continue;
    }

    const csvParts = parseCsvLine(block);
    if (csvParts.length >= 2) {
      entries.push({
        question: csvParts[0]!,
        answer: csvParts.slice(2).join(" ") || csvParts[1]!,
        category: csvParts.length >= 3 ? csvParts[1] : undefined,
      });
    }
  }

  return entries;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((ch === "," || ch === "\t") && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result.filter(Boolean);
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { dataClient, userId } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    entries?: BulkEntryInput[];
    text?: string;
    csv?: string;
  };

  let items: BulkEntryInput[] = body.entries ?? [];
  if (body.text) items = [...items, ...parseBulkText(body.text)];
  if (body.csv) {
    const lines = body.csv.split("\n").map((l) => l.trim()).filter(Boolean);
    const dataLines = lines[0]?.toLowerCase().includes("question")
      ? lines.slice(1)
      : lines;
    for (const line of dataLines) {
      const parts = parseCsvLine(line);
      if (parts.length >= 2) {
        items.push({
          question: parts[0]!,
          category: parts.length >= 3 ? parts[1] : "General",
          answer: parts.length >= 3 ? parts.slice(2).join(", ") : parts[1]!,
        });
      }
    }
  }

  items = items.filter((e) => e.question?.trim() && e.answer?.trim());
  if (items.length === 0) {
    return NextResponse.json({ error: "No valid entries to import." }, { status: 400 });
  }

  const created: AIKnowledgeEntry[] = [];
  let skippedDuplicates = 0;

  for (const item of items) {
    const category = item.category?.trim() || "General";
    const question = item.question.trim();
    const generated = generateKeywordsFromQuestion(question, category);
    const payload: KnowledgeEntryPayload = {
      category,
      question,
      answer: item.answer.trim(),
      keywords: generated.keywords,
      search_phrases: generated.search_phrases,
      alternative_wording: generated.alternative_wording,
      synonyms: generated.synonyms,
      related_terms: generated.related_terms,
      priority: item.priority ?? "normal",
    };

    const result = await createKnowledgeEntry(dataClient, payload, userId, {
      duplicateAction: "create",
    });

    if (!result.ok) {
      if ("duplicate" in result && result.duplicate) {
        skippedDuplicates++;
        continue;
      }
      return NextResponse.json(
        { error: "error" in result ? result.error : "Import failed." },
        { status: 500 }
      );
    }

    created.push(result.row);
  }

  for (const row of created) {
    void syncKnowledgeEntryEmbeddingSafe(dataClient, row);
  }

  return NextResponse.json({
    ok: true,
    count: created.length,
    skippedDuplicates,
  });
}
