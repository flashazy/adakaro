/**
 * Watchdog monitoring — types only (no runtime side effects).
 */

export type WatchdogRole = "admin" | "parent" | "super_admin" | "unknown";

export type WatchdogSeverity = "low" | "medium" | "high";

export interface WatchdogEvent {
  /** Rule key, e.g. receipt_generation */
  feature: string;
  role: WatchdogRole;
  /** Whether the observed action reported success */
  success: boolean;
  metadata?: Record<string, unknown>;
  /** Epoch ms; set by tracker if omitted */
  timestamp?: number;
}

export interface WatchdogAlert {
  id: string;
  feature: string;
  description: string;
  severity: WatchdogSeverity;
  timestamp: number;
  affected_role: WatchdogRole;
}

/** Per-role expectations for a feature (optional keys = not enforced) */
export interface RoleExpectation {
  must_have_logo?: boolean;
  must_succeed?: boolean;
  must_complete?: boolean;
}

export interface FeatureRule {
  admin?: RoleExpectation;
  parent?: RoleExpectation;
  super_admin?: RoleExpectation;
}
