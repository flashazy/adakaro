/**
 * Role verification with internal debug logging.
 * Never silently downgrades users; never defaults to Teacher.
 */

import type { CopilotContext } from "@/lib/ai/types";
import { logCopilotEvent } from "@/lib/ai/copilot-events";

export interface RoleVerificationResult {
  ok: boolean;
  message?: string;
}

export function verifyCopilotRole(ctx: CopilotContext): RoleVerificationResult {
  if (process.env.NODE_ENV === "development") {
    console.info("[copilot-role]", {
      userId: ctx.userId,
      schoolId: ctx.schoolId,
      schoolName: ctx.schoolName,
      role: ctx.role,
      roleResolved: ctx.roleResolved,
      copilotEnabled: ctx.copilotEnabled,
      allowedTools: ctx.allowedTools.length,
    });
  }

  if (!ctx.roleResolved) {
    logCopilotEvent({
      type: "role_unresolved",
      message: "Role could not be verified",
      userId: ctx.userId,
      schoolId: ctx.schoolId,
      role: ctx.role,
    });
    return {
      ok: false,
      message:
        "I couldn't verify your school role right now. Please refresh and try again.",
    };
  }

  if (!ctx.copilotEnabled) {
    logCopilotEvent({
      type: "copilot_disabled",
      message: "Copilot not enabled for school",
      userId: ctx.userId,
      schoolId: ctx.schoolId,
      role: ctx.role,
    });
    return {
      ok: false,
      message: "Adakaro Copilot is not enabled for this school yet.",
    };
  }

  return { ok: true };
}
