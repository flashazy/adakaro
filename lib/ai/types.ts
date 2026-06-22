export type AIProduct = "public" | "copilot";

export type AIMessageRole = "user" | "assistant" | "system";

export type AIStreamStatus = "idle" | "thinking" | "streaming" | "error";

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AIConversation {
  id: string;
  product: AIProduct;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  schoolId?: string | null;
}

export interface AISuggestion {
  id: string;
  label: string;
  prompt: string;
}

export type CopilotRole =
  | "admin"
  | "teacher"
  | "finance"
  | "coordinator"
  | "parent"
  | "super_admin";

export interface CopilotContext {
  userId: string;
  schoolId: string | null;
  schoolName: string | null;
  role: CopilotRole;
  displayName: string;
  allowedTools: string[];
}

export interface ChatRequestBody {
  conversationId?: string | null;
  message: string;
  product: AIProduct;
  regenerate?: boolean;
  anonymousSessionId?: string | null;
}

export interface ChatStreamEvent {
  type:
    | "token"
    | "done"
    | "error"
    | "suggestions"
    | "conversation"
    | "copilot_meta";
  content?: string;
  messageId?: string;
  conversationId?: string;
  suggestions?: AISuggestion[];
  copilotMeta?: import("@/lib/ai/copilot/types").CopilotMessageMeta;
  error?: string;
}

export interface ToolResult {
  tool: string;
  summary: string;
  data?: Record<string, unknown>;
}
