import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportHealthAlert } from "@/lib/watchdog/report-health-alert";
import { getRuleForFeature } from "@/watchdog/rules";
import type { WatchdogEvent, WatchdogRole } from "@/watchdog/types";

function mapSeverity(
  streak: number,
  base: "low" | "medium" | "high"
): "low" | "medium" | "high" | "critical" {
  if (streak >= 5) return "critical";
  if (streak >= 3) return base === "low" ? "medium" : "high";
  return base;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: WatchdogEvent;
  try {
    body = (await request.json()) as WatchdogEvent;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const feature = body.feature?.trim();
  if (!feature) {
    return NextResponse.json({ error: "Missing feature." }, { status: 400 });
  }

  const rule = getRuleForFeature(feature);
  const role = body.role as WatchdogRole;
  const rk =
    role === "admin" || role === "parent" || role === "super_admin"
      ? role
      : null;
  const expectation = rk ? rule?.[rk] : undefined;
  const meta = body.metadata ?? {};

  if (expectation?.must_have_logo === true && meta.hasLogo === false) {
    await reportHealthAlert({
      feature,
      severity: "medium",
      title: "Receipt missing school logo",
      message: `A ${rk} viewed a payment receipt without the required school logo.`,
      dedupeKey: `${feature}:missing_logo:${rk}`,
      metadata: { role: rk, hasLogo: false },
    });
  }

  if (expectation?.must_succeed === true && body.success === false) {
    await reportHealthAlert({
      feature,
      severity: mapSeverity(1, "medium"),
      title: `${feature} reported failure`,
      message: `Expected success for ${feature} (${rk}) but the client reported failure.`,
      dedupeKey: `${feature}:must_succeed:${rk}`,
      metadata: { role: rk, success: false, ...meta },
    });
  }

  if (expectation?.must_complete === true) {
    const completed = meta.completed;
    if (body.success === false || completed === false) {
      await reportHealthAlert({
        feature,
        severity: "medium",
        title: `${feature} did not complete`,
        message: `Payment flow for ${rk} did not complete as expected.`,
        dedupeKey: `${feature}:must_complete:${rk}`,
        metadata: { role: rk, ...meta },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
