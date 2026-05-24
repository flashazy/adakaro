"use client";

import type { ClassSendEligibilityPreview } from "@/lib/report-card-fee/types";

const TTL_MS = 2 * 60 * 1000;
/** Show "Refresh" hint when data is older than this. */
const STALE_MS = 60 * 1000;

export interface SendEligibilityCacheEntry {
  preview: ClassSendEligibilityPreview;
  fetchedAt: number;
}

const memoryCache = new Map<string, SendEligibilityCacheEntry>();

export function sendEligibilityClientCacheKey(
  classId: string,
  term: string,
  academicYear: string
): string {
  return `${classId}::${term}::${academicYear}`;
}

export function getClientSendEligibilityCache(
  key: string
): SendEligibilityCacheEntry | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return hit;
}

export function setClientSendEligibilityCache(
  key: string,
  preview: ClassSendEligibilityPreview
): void {
  memoryCache.set(key, { preview, fetchedAt: Date.now() });
}

export function clearClientSendEligibilityCache(key: string): void {
  memoryCache.delete(key);
}

export function isClientSendEligibilityStale(entry: SendEligibilityCacheEntry): boolean {
  return Date.now() - entry.fetchedAt > STALE_MS;
}
