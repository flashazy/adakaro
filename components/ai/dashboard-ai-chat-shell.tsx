"use client";

import { AICopilotAssistant } from "./AICopilotAssistant";
import { AIChatUIProvider } from "./ai-chat-ui-context";

export function DashboardAIChatShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AIChatUIProvider>
      {children}
      <AICopilotAssistant />
    </AIChatUIProvider>
  );
}
