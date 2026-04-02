"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/watchdog/tracker";

interface ReceiptWatchdogTrackerProps {
  paymentId: string;
  hasLogo: boolean;
  /** Narrow role for receipt context */
  role: "admin" | "parent";
}

/**
 * Fires once per distinct payment + logo + role (avoids duplicate alerts on re-renders / Strict Mode).
 */
export function ReceiptWatchdogTracker({
  paymentId,
  hasLogo,
  role,
}: ReceiptWatchdogTrackerProps) {
  const lastTrackedKey = useRef<string | null>(null);

  useEffect(() => {
    const key = `${paymentId}|${hasLogo}|${role}`;
    if (lastTrackedKey.current === key) return;
    lastTrackedKey.current = key;

    trackEvent({
      feature: "receipt_generation",
      role,
      success: true,
      metadata: { hasLogo },
    });
  }, [paymentId, hasLogo, role]);

  return null;
}
