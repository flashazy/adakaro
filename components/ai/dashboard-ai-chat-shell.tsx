"use client";

import { AICopilotAssistant } from "./AICopilotAssistant";
import { AIChatUIProvider } from "./ai-chat-ui-context";

export function DashboardAIChatShell({
  children,
  copilotEnabled = false,
}: {
  children: React.ReactNode;
  /** Super-admin rollout flag for the active school. */
  copilotEnabled?: boolean;
}) {
  return (
    <AIChatUIProvider>
      {children}
      {copilotEnabled ? <AICopilotAssistant /> : null}
    </AIChatUIProvider>
  );
}
