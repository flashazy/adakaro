"use client";

import { AIPublicAssistant } from "./AIPublicAssistant";
import { AIChatUIProvider } from "./ai-chat-ui-context";

export function MarketingAIChatShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AIChatUIProvider>
      {children}
      <AIPublicAssistant />
    </AIChatUIProvider>
  );
}
