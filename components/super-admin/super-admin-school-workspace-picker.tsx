"use client";

import {
  saBtnPrimarySm,
  saBtnSecondary,
  saSearchInput,
  saStatusBadge,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { enterSuperAdminSchoolWorkspace } from "@/lib/super-admin/open-school-workspace.client";
import {
  schoolLifecycleStatusBadgeClass,
  schoolLifecycleStatusLabel,
  type SchoolLifecycleStatus,
} from "@/lib/super-admin/school-lifecycle";
import { binaryPlanLabel } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Building2, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface WorkspaceSchoolOption {
  id: string;
  name: string;
  plan: string;
  school_status: SchoolLifecycleStatus;
  student_count: number;
  health_score: number;
}

interface SuperAdminSchoolWorkspacePickerProps {
  open: boolean;
  onClose: () => void;
}

export function SuperAdminSchoolWorkspacePicker({
  open,
  onClose,
}: SuperAdminSchoolWorkspacePickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schools, setSchools] = useState<WorkspaceSchoolOption[]>([]);
  const [search, setSearch] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  const resetListScroll = useCallback(() => {
    const el = listScrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, []);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/schools/workspace", {
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as {
        schools?: WorkspaceSchoolOption[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error?.trim() || "Could not load schools.");
      }
      setSchools(body.schools ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load schools.");
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    resetListScroll();
    void loadSchools();
  }, [open, loadSchools, resetListScroll]);

  useEffect(() => {
    if (!open || loading) return;
    resetListScroll();
    const frame = requestAnimationFrame(() => resetListScroll());
    return () => cancelAnimationFrame(frame);
  }, [open, loading, schools.length, resetListScroll]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.name.toLowerCase().includes(q));
  }, [schools, search]);

  async function handleOpenSchool(schoolId: string) {
    setOpeningId(schoolId);
    setError(null);
    const result = await enterSuperAdminSchoolWorkspace(schoolId);
    if (!result.ok) {
      setError(result.error);
      setOpeningId(null);
    }
  }

  if (!open || !portalMounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-slate-900/50 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-picker-title"
        className="flex h-[min(90vh,900px)] w-full max-w-[1024px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:border-zinc-700 dark:bg-zinc-900 sm:h-[85vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header: title + search */}
        <div className="shrink-0 border-b border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
            <div className="min-w-0">
              <h2
                id="workspace-picker-title"
                className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
              >
                Open School Workspace
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Choose a school workspace to open. You can return to Super Admin
                anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="px-5 pb-4 sm:px-6">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schools..."
                className={cn(saSearchInput, "pl-9")}
              />
            </div>
          </div>
        </div>

        {/* Scrollable school list */}
        <div
          ref={listScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]"
        >
          <div className="px-5 pb-8 pt-3 sm:px-6 sm:pb-10">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading schools...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                <Building2
                  className="h-8 w-8 text-slate-300 dark:text-zinc-600"
                  aria-hidden
                />
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  {schools.length === 0
                    ? "No active schools available."
                    : "No schools match your search."}
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((school) => (
                  <li
                    key={school.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 transition-colors hover:border-slate-300 hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {school.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={saStatusBadge}>
                          {binaryPlanLabel(school.plan)}
                        </span>
                        <span
                          className={cn(
                            saStatusBadge,
                            schoolLifecycleStatusBadgeClass(school.school_status)
                          )}
                        >
                          {schoolLifecycleStatusLabel(school.school_status)}
                        </span>
                        <span className="text-slate-500 dark:text-zinc-400">
                          {school.student_count.toLocaleString()} students
                        </span>
                        <span className="text-slate-500 dark:text-zinc-400">
                          Health {school.health_score}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={openingId != null}
                      onClick={() => void handleOpenSchool(school.id)}
                      className={cn(
                        saBtnPrimarySm,
                        "shrink-0 self-start sm:self-center",
                        openingId != null && openingId !== school.id && "opacity-60"
                      )}
                    >
                      {openingId === school.id ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Opening…
                        </>
                      ) : (
                        "Open Workspace"
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
          <button type="button" onClick={onClose} className={saBtnSecondary}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
