import { evaluateEvent } from "./detector";
import type { WatchdogEvent } from "./types";

/**
 * Public API: call from client (or server) when a monitored action finishes.
 * Never throws; failures inside are swallowed.
 */
export function trackEvent(event: WatchdogEvent): void {
  try {
    if (event == null || typeof event !== "object") return;
    const feature = typeof event.feature === "string" ? event.feature.trim() : "";
    if (!feature) return;

    const normalized: WatchdogEvent = {
      ...event,
      feature,
      timestamp: event.timestamp ?? Date.now(),
    };

    evaluateEvent(normalized);
  } catch {
    /* optional monitoring — never break callers */
  }
}
