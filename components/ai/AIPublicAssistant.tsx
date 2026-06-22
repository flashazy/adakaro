"use client";

import { AIChatFloatButton, AIChatWidget } from "./AIChatWidget";
import { useAIChatUI } from "./ai-chat-ui-context";

export function AIPublicAssistant() {
  const ui = useAIChatUI();
  const isOpen = ui?.isOpen ?? false;
  const open = ui?.open ?? (() => {});
  const close = ui?.close ?? (() => {});

  return (
    <>
      {!isOpen ? (
        <AIChatFloatButton
          onClick={open}
          label="Ask Adakaro AI"
          subtle
          className="bottom-[11.5rem] left-4 sm:bottom-32 sm:left-8"
        />
      ) : null}
      <AIChatWidget
        product="public"
        mode="widget"
        open={isOpen}
        onClose={close}
      />
    </>
  );
}
