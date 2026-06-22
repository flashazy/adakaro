"use client";

import { useState } from "react";
import { AIChatWidget } from "./AIChatWidget";
import { useAIChatUI } from "./ai-chat-ui-context";
import {
  CopilotDock,
  copilotStatusFromChat,
  type CopilotAIStatus,
} from "./copilot-dock";

export function AICopilotAssistant() {
  const ui = useAIChatUI();
  const isOpen = ui?.isOpen ?? false;
  const open = ui?.open ?? (() => {});
  const close = ui?.close ?? (() => {});
  const [status, setStatus] = useState<CopilotAIStatus>("ready");

  return (
    <>
      {!isOpen ? <CopilotDock onClick={open} status={status} /> : null}
      <AIChatWidget
        product="copilot"
        mode="widget"
        open={isOpen}
        onClose={close}
        onChatStatusChange={(chatStatus, meta) => {
          setStatus(
            copilotStatusFromChat(chatStatus, {
              trainingRequired: meta?.trainingRequired,
            })
          );
        }}
      />
    </>
  );
}
