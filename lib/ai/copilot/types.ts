import type { AISuggestion } from "@/lib/ai/types";

export type CopilotResponseType =
  | "summary"
  | "table"
  | "metrics"
  | "recommendations"
  | "report";

export type CopilotConfidence = "high" | "low" | "none";

export interface CopilotMetricBlock {
  type: "metrics";
  items: Array<{ label: string; value: string; highlight?: boolean }>;
}

export interface CopilotTableBlock {
  type: "table";
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface CopilotInsightBlock {
  type: "insight";
  icon: "alert" | "trend" | "academic" | "info";
  title: string;
  body: string;
  recommendation?: string;
}

export interface CopilotRecommendationBlock {
  type: "recommendations";
  items: string[];
}

export type CopilotBlock =
  | CopilotMetricBlock
  | CopilotTableBlock
  | CopilotInsightBlock
  | CopilotRecommendationBlock;

export interface CopilotMessageMeta {
  schoolName?: string;
  responseType: CopilotResponseType;
  confidence: CopilotConfidence;
  blocks: CopilotBlock[];
  actions: AISuggestion[];
}

export interface CopilotSnapshot {
  schoolName: string;
  studentCount: number;
  attendanceRate: number;
  outstandingFees: number;
  syllabusAlerts: number;
  actions: AISuggestion[];
}

export interface ConversationFilters {
  gradeFilter?: string;
  classFilter?: string;
  sortByBalance?: boolean;
  limit?: number;
}
