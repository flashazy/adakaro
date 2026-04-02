import { addAlert, recordFailureStreak, resetFailureStreak, severityFromStreak } from "./alerts.store";
import { getRuleForFeature } from "./rules";
import type { WatchdogEvent, WatchdogRole, WatchdogSeverity } from "./types";

function roleKey(role: WatchdogRole): "admin" | "parent" | "super_admin" | undefined {
  if (role === "admin" || role === "parent" || role === "super_admin") return role;
  return undefined;
}

function boolMeta(meta: Record<string, unknown> | undefined, key: string): boolean | undefined {
  if (!meta || !(key in meta)) return undefined;
  const v = meta[key];
  return typeof v === "boolean" ? v : undefined;
}

/**
 * Compares an event to `WATCHDOG_RULES` and emits alerts on mismatch.
 * Safe to call from tracker; does not throw.
 */
export function evaluateEvent(event: WatchdogEvent): void {
  try {
    const rule = getRuleForFeature(event.feature);
    if (!rule) return;

    const rk = roleKey(event.role);
    if (!rk) return;

    const expectation = rule[rk];
    if (!expectation) return;

    const meta = event.metadata ?? {};

    if (expectation.must_succeed === true && !event.success) {
      const streak = recordFailureStreak(event.feature, event.role);
      const base: WatchdogSeverity = streak >= 3 ? "high" : "medium";
      addAlert({
        feature: event.feature,
        description: `Expected success for ${event.feature} (${rk}) but operation reported failure.`,
        severity: severityFromStreak(base, streak),
        affected_role: event.role,
      });
      return;
    }

    if (expectation.must_complete === true) {
      const completed = boolMeta(meta, "completed");
      if (event.success === false || completed === false) {
        const streak = recordFailureStreak(event.feature, event.role);
        addAlert({
          feature: event.feature,
          description: `Payment flow for ${rk} did not complete as expected.`,
          severity: severityFromStreak("medium", streak),
          affected_role: event.role,
        });
        return;
      }
    }

    if (expectation.must_have_logo === true) {
      const hasLogo = boolMeta(meta, "hasLogo");
      if (hasLogo === false) {
        const streak = recordFailureStreak(`${event.feature}:logo`, event.role);
        addAlert({
          feature: event.feature,
          description: `Receipt or document is missing required logo for role "${rk}".`,
          severity: severityFromStreak("medium", streak),
          affected_role: event.role,
        });
        return;
      }
    }

    if (event.success) {
      resetFailureStreak(event.feature, event.role);
      resetFailureStreak(`${event.feature}:logo`, event.role);
    }
  } catch {
    /* detector must never throw */
  }
}
