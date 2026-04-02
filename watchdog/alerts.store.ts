import type { WatchdogAlert, WatchdogRole, WatchdogSeverity } from "./types";

const MAX_ALERTS = 500;

let alerts: WatchdogAlert[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener errors */
    }
  });
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `wd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function addAlert(
  partial: Omit<WatchdogAlert, "id" | "timestamp"> &
    Partial<Pick<WatchdogAlert, "id" | "timestamp">>
): WatchdogAlert {
  const alert: WatchdogAlert = {
    id: partial.id ?? newId(),
    feature: partial.feature,
    description: partial.description,
    severity: partial.severity,
    timestamp: partial.timestamp ?? Date.now(),
    affected_role: partial.affected_role,
  };
  alerts = [alert, ...alerts].slice(0, MAX_ALERTS);
  notify();
  return alert;
}

export function clearAlert(id: string): void {
  alerts = alerts.filter((a) => a.id !== id);
  notify();
}

export function clearAllAlerts(): void {
  alerts = [];
  notify();
}

export function getAlerts(): WatchdogAlert[] {
  return [...alerts];
}

/** Stable empty snapshot — getServerSnapshot must not return a new [] each call. */
const EMPTY_ALERTS: WatchdogAlert[] = [];

/** For React useSyncExternalStore — must return the same reference until the store mutates. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): WatchdogAlert[] {
  return alerts;
}

export function getServerSnapshot(): WatchdogAlert[] {
  return EMPTY_ALERTS;
}

/** In-memory failure streaks for escalation (feature + role) */
const failureStreaks = new Map<string, number>();

export function recordFailureStreak(feature: string, role: WatchdogRole): number {
  const key = `${feature}:${role}`;
  const n = (failureStreaks.get(key) ?? 0) + 1;
  failureStreaks.set(key, n);
  return n;
}

export function resetFailureStreak(feature: string, role: WatchdogRole): void {
  failureStreaks.delete(`${feature}:${role}`);
}

export function severityFromStreak(
  base: WatchdogSeverity,
  streak: number
): WatchdogSeverity {
  if (streak >= 5) return "high";
  if (streak >= 3) return base === "low" ? "medium" : "high";
  return base;
}
