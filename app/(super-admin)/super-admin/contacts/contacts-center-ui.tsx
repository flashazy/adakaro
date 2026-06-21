"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { binaryPlanLabel } from "@/lib/plans";
import { enterSuperAdminSchoolWorkspace } from "@/lib/super-admin/open-school-workspace.client";
import {
  SuperAdminExportLink,
  SuperAdminLoadingButton,
  SuperAdminNavLink,
  useCopyWithFeedback,
} from "@/components/super-admin/super-admin-loading-action";
import type {
  SuperAdminContactCoverage,
  SuperAdminContactInsights,
  SuperAdminContactRow,
} from "@/lib/super-admin/contacts-types";
import {
  contactMutedDetails,
  contactRoleContext,
  contactRowCopyText,
  contactSchoolStatusBadgeClass,
  contactSourceDisplay,
  contactTypeLabel,
  schoolHealthStatus,
  schoolInitials,
} from "@/lib/super-admin/contacts-utils";
import { schoolLifecycleStatusLabel } from "@/lib/super-admin/school-lifecycle";
import {
  buildContactRowSchoolProfileHref,
  type ContactsRowActionContext,
} from "@/lib/super-admin/smart-intelligence-navigation";
import {
  saBtnActionMenu,
  saBtnSecondarySm,
  saChipCalm,
  saStatusBadge,
  saTableHeadCell,
  saTableHeadRow,
  saTableRowHover,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";

export function ContactsExecutiveHeader({
  lastUpdated,
  schoolsRepresented,
  totalContacts,
  loading = false,
  filteredSchoolName = null,
  backHref = "/super-admin",
  backLabel = "Back",
  backLoadingLabel = "Loading…",
}: {
  lastUpdated: string | null;
  schoolsRepresented: number;
  totalContacts: number;
  loading?: boolean;
  filteredSchoolName?: string | null;
  backHref?: string;
  backLabel?: string;
  backLoadingLabel?: string;
}) {
  const formatted =
    lastUpdated != null
      ? new Date(lastUpdated).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  const summaryLine = loading
    ? "Loading contact summary…"
    : filteredSchoolName
      ? `${totalContacts.toLocaleString()} contacts for ${filteredSchoolName} • Updated ${formatted}`
      : `${totalContacts.toLocaleString()} contacts • ${schoolsRepresented.toLocaleString()} schools • Updated ${formatted}`;

  return (
    <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/40 px-5 py-5 shadow-sm sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
                Super Admin
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Contacts Center
              </h1>
              <p className="mt-1 text-sm text-slate-500">{summaryLine}</p>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                {filteredSchoolName
                  ? `Official contacts for ${filteredSchoolName}.`
                  : "Official communication directory across all Adakaro schools."}
              </p>
            </div>
            <SuperAdminNavLink
              href={backHref}
              loadingLabel={backLoadingLabel}
              className="shrink-0 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-white"
            >
              {backLabel}
            </SuperAdminNavLink>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm lg:justify-end">
          <span className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-slate-600 shadow-sm">
            <span className="text-slate-500">Last updated</span>{" "}
            <span className="font-medium tabular-nums text-slate-900">
              {formatted}
            </span>
          </span>
          <span className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
            <span className="text-slate-500">Schools represented</span>{" "}
            <span className="font-semibold tabular-nums text-slate-900">
              {schoolsRepresented}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

export function ContactsInsightChips({
  insights,
  loading,
}: {
  insights: SuperAdminContactInsights | undefined;
  loading: boolean;
}) {
  const chips = [
    {
      label: "Schools represented",
      value: insights?.schoolsRepresented ?? "—",
    },
    {
      label: "Active schools",
      value: insights?.activeSchoolsRepresented ?? "—",
    },
    {
      label: "Missing phone",
      value: insights?.missingPhone ?? "—",
      tone: "amber" as const,
    },
    {
      label: "Missing email",
      value: insights?.missingEmail ?? "—",
      tone: "amber" as const,
    },
    {
      label: "Duplicates detected",
      value: insights?.duplicatesDetected ?? "—",
      tone: "rose" as const,
    },
    {
      label: "Most common role",
      value: insights?.mostCommonRole ?? "—",
      tone: "indigo" as const,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={cn(
            saChipCalm,
            chip.tone === "amber" &&
              "bg-amber-50 text-amber-900 ring-amber-200/80",
            chip.tone === "rose" &&
              "bg-rose-50 text-rose-900 ring-rose-200/80",
            chip.tone === "indigo" &&
              "bg-indigo-50 text-indigo-900 ring-indigo-200/80",
            !chip.tone && "bg-slate-50 text-slate-700 ring-slate-200/80"
          )}
        >
          <span className="text-slate-500">{chip.label}:</span>{" "}
          <span className="font-semibold tabular-nums">
            {loading ? "…" : chip.value}
          </span>
        </span>
      ))}
    </div>
  );
}

export function ContactsCoverageWidget({
  coverage,
  loading,
}: {
  coverage: SuperAdminContactCoverage | undefined;
  loading: boolean;
}) {
  const phone = coverage?.phonePercent ?? 0;
  const email = coverage?.emailPercent ?? 0;
  const scope = coverage?.scopeLabel ?? "contacts";
  const total = coverage?.total ?? 0;
  const withPhone = coverage?.withPhone ?? 0;
  const withEmail = coverage?.withEmail ?? 0;

  const phoneDetail =
    total === 0
      ? `No ${scope} in current filter`
      : `${withPhone} of ${total} ${scope} have phone numbers`;
  const emailDetail =
    total === 0
      ? `No ${scope} in current filter`
      : `${withEmail} of ${total} ${scope} have email addresses`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CoverageBar
        label="Phone coverage"
        percent={phone}
        detail={phoneDetail}
        loading={loading}
        barClassName="bg-emerald-500"
      />
      <CoverageBar
        label="Email coverage"
        percent={email}
        detail={emailDetail}
        loading={loading}
        barClassName="bg-indigo-500"
      />
    </div>
  );
}

function CoverageBar({
  label,
  percent,
  detail,
  loading,
  barClassName,
}: {
  label: string;
  percent: number;
  detail: string;
  loading: boolean;
  barClassName: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-bold tabular-nums text-slate-900">
          {loading ? "—" : `${percent}%`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barClassName)}
          style={{ width: loading ? "0%" : `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {loading ? "Calculating coverage…" : detail}
      </p>
    </div>
  );
}

export function ContactsQuickActions({
  loading,
  copyBusy,
  onCopyPhones,
  onCopyEmails,
  exportAllUrl,
  exportAdminsUrl,
  exportTeachersUrl,
  exportParentsUrl,
}: {
  loading: boolean;
  copyBusy: boolean;
  onCopyPhones: () => void;
  onCopyEmails: () => void;
  exportAllUrl: string;
  exportAdminsUrl: string;
  exportTeachersUrl: string;
  exportParentsUrl: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Quick actions
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <SuperAdminExportLink
          href={exportAllUrl}
          className={cn(saBtnSecondarySm, "bg-white")}
          aria-disabled={loading}
        >
          Export all contacts
        </SuperAdminExportLink>
        <SuperAdminExportLink
          href={exportTeachersUrl}
          className={cn(saBtnSecondarySm, "bg-white")}
        >
          Export teachers
        </SuperAdminExportLink>
        <SuperAdminExportLink
          href={exportParentsUrl}
          className={cn(saBtnSecondarySm, "bg-white")}
        >
          Export parents
        </SuperAdminExportLink>
        <SuperAdminExportLink
          href={exportAdminsUrl}
          className={cn(saBtnSecondarySm, "bg-white")}
        >
          Export admins
        </SuperAdminExportLink>
        <SuperAdminLoadingButton
          type="button"
          disabled={copyBusy || loading}
          loading={copyBusy}
          loadingLabel="Copying…"
          onClick={onCopyPhones}
          className={saBtnSecondarySm}
        >
          Copy all phones
        </SuperAdminLoadingButton>
        <SuperAdminLoadingButton
          type="button"
          disabled={copyBusy || loading}
          loading={copyBusy}
          loadingLabel="Copying…"
          onClick={onCopyEmails}
          className={saBtnSecondarySm}
        >
          Copy all emails
        </SuperAdminLoadingButton>
      </div>
    </div>
  );
}

export function SchoolAvatar({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  const initials = schoolInitials(name);

  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-100 to-slate-100 text-xs font-bold text-indigo-800 ring-1 ring-slate-200/80",
        className
      )}
      title={name}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${name} logo`}
          fill
          className="object-cover"
          sizes="40px"
          unoptimized
        />
      ) : (
        initials
      )}
    </div>
  );
}

export function ContactsEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">
        No contacts match your filters
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Try clearing filters, changing the plan filter, or searching for another
        school.
      </p>
      <ul className="mt-4 space-y-1 text-left text-sm text-slate-600">
        <li>• Clearing filters</li>
        <li>• Changing plan filter</li>
        <li>• Searching another school</li>
      </ul>
      <button type="button" onClick={onClear} className={cn(saBtnSecondarySm, "mt-6")}>
        Clear filters
      </button>
    </div>
  );
}

export function ContactActionsMenu({
  row,
  actionContext = {},
}: {
  row: SuperAdminContactRow;
  actionContext?: ContactsRowActionContext;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewOpening, setViewOpening] = useState(false);
  const [schoolOpening, setSchoolOpening] = useState(false);
  const [workspaceOpening, setWorkspaceOpening] = useState(false);
  const phoneCopy = useCopyWithFeedback();
  const emailCopy = useCopyWithFeedback();
  const rowCopy = useCopyWithFeedback();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const schoolProfileHref = buildContactRowSchoolProfileHref(
    row.schoolId,
    actionContext
  );

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const menuStyle = usePortalMenuPosition(open, triggerRef, menuRef);

  const actionBusy = viewOpening || schoolOpening || workspaceOpening;

  async function handleViewContact() {
    if (viewOpening) return;
    setViewOpening(true);
    try {
      setViewOpen(true);
      closeMenu();
    } finally {
      setViewOpening(false);
    }
  }

  async function handleOpenSchool() {
    if (schoolOpening) return;
    setSchoolOpening(true);
    try {
      await router.push(schoolProfileHref);
      closeMenu();
    } catch {
      toast.error("Could not open school profile.");
    } finally {
      setSchoolOpening(false);
    }
  }

  async function handleWorkspace() {
    if (workspaceOpening) return;
    setWorkspaceOpening(true);
    try {
      const result = await enterSuperAdminSchoolWorkspace(row.schoolId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      closeMenu();
    } finally {
      setWorkspaceOpening(false);
    }
  }

  async function copyPhone() {
    if (!row.phone) {
      toast.message("No phone number on this contact.");
      return;
    }
    const ok = await phoneCopy.copy(row.phone, () =>
      toast.error("Could not copy phone.")
    );
    if (ok) toast.success("Phone copied");
    closeMenu();
  }

  async function copyEmail() {
    if (!row.email) {
      toast.message("No email address on this contact.");
      return;
    }
    const ok = await emailCopy.copy(row.email, () =>
      toast.error("Could not copy email.")
    );
    if (ok) toast.success("Email copied");
    closeMenu();
  }

  async function copyRow() {
    const ok = await rowCopy.copy(contactRowCopyText(row), () =>
      toast.error("Could not copy contact row.")
    );
    if (ok) toast.success("Contact row copied");
    closeMenu();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={saBtnActionMenu}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-busy={actionBusy}
        disabled={actionBusy}
      >
        {actionBusy ? "Opening…" : "Actions"}
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
        </svg>
      </button>

      {open && menuStyle
        ? createPortal(
            <ContactActionsPortalMenu
              menuRef={menuRef}
              menuStyle={menuStyle}
              onClose={closeMenu}
            >
              <ContactMenuItem
                disabled={viewOpening}
                onClick={() => void handleViewContact()}
              >
                {viewOpening ? "Opening…" : "View contact"}
              </ContactMenuItem>
              <ContactMenuItem
                disabled={schoolOpening}
                onClick={() => void handleOpenSchool()}
              >
                {schoolOpening ? "Opening…" : "Open school"}
              </ContactMenuItem>
              <ContactMenuItem
                disabled={phoneCopy.isCopying}
                onClick={() => void copyPhone()}
              >
                {phoneCopy.isCopying
                  ? "Copying…"
                  : row.phone
                    ? "Copy phone"
                    : "Copy phone (missing)"}
              </ContactMenuItem>
              <ContactMenuItem
                disabled={emailCopy.isCopying}
                onClick={() => void copyEmail()}
              >
                {emailCopy.isCopying
                  ? "Copying…"
                  : row.email
                    ? "Copy email"
                    : "Copy email (missing)"}
              </ContactMenuItem>
              <ContactMenuItem
                disabled={rowCopy.isCopying}
                onClick={() => void copyRow()}
              >
                {rowCopy.isCopying ? "Copying…" : "Copy row"}
              </ContactMenuItem>
              {row.contactType === "admin" ? (
                <ContactMenuItem
                  disabled={workspaceOpening}
                  onClick={() => void handleWorkspace()}
                >
                  {workspaceOpening ? "Opening…" : "Open school workspace"}
                </ContactMenuItem>
              ) : null}
            </ContactActionsPortalMenu>,
            document.body
          )
        : null}

      {viewOpen ? (
        <ContactViewModal row={row} onClose={() => setViewOpen(false)} />
      ) : null}
    </>
  );
}

function usePortalMenuPosition(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>
): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 280;
    const menuWidth = menuRef.current?.offsetWidth ?? 192;
    const gap = 6;

    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    let top = openUp ? rect.top - menuHeight - gap : rect.bottom + gap;
    top = Math.max(gap, Math.min(top, window.innerHeight - menuHeight - gap));

    let left = rect.right - menuWidth;
    left = Math.max(gap, Math.min(left, window.innerWidth - menuWidth - gap));

    setStyle({
      position: "fixed",
      top,
      left,
      minWidth: "12rem",
      zIndex: 201,
    });
  }, [anchorRef, menuRef]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  return style;
}

function ContactActionsPortalMenu({
  menuRef,
  menuStyle,
  onClose,
  children,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuStyle: CSSProperties;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([disabled])'
    );
    first?.focus();
  }, [menuRef]);

  return (
    <>
      <div
        className="fixed inset-0 z-[200]"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={menuRef}
        role="menu"
        style={menuStyle}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}

function ContactMenuItem({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ContactNameBlock({ row }: { row: SuperAdminContactRow }) {
  const roleContext = contactRoleContext(row);
  const muted = contactMutedDetails(row);

  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-slate-900">{row.name}</p>
      {roleContext ? (
        <p className="mt-0.5 truncate text-sm text-slate-600">{roleContext}</p>
      ) : null}
      {row.contactType === "admin" && row.healthScore != null ? (
        <ContactHealthIndicator score={row.healthScore} />
      ) : null}
      {muted ? (
        <p className="mt-0.5 truncate text-xs text-slate-400">{muted}</p>
      ) : null}
    </div>
  );
}

function ContactHealthIndicator({ score }: { score: number }) {
  const status = schoolHealthStatus(score);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-xs text-slate-500">
        Health:{" "}
        <span className={cn("font-semibold tabular-nums", status.textClassName)}>
          {score}/100
        </span>
      </span>
      <span
        className={cn(
          "inline-flex h-4 items-center rounded-full px-1.5 text-[10px] font-semibold ring-1 ring-inset",
          status.badgeClassName
        )}
      >
        {status.label}
      </span>
      <div className="h-1 w-14 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full", status.barClassName)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

function SchoolNameLink({ row }: { row: SuperAdminContactRow }) {
  const [opening, setOpening] = useState(false);

  async function openWorkspace() {
    if (opening) return;
    setOpening(true);
    try {
      const result = await enterSuperAdminSchoolWorkspace(row.schoolId);
      if (!result.ok) {
        toast.error(result.error);
      }
    } finally {
      setOpening(false);
    }
  }

  return (
    <SuperAdminLoadingButton
      type="button"
      loading={opening}
      loadingLabel="Opening…"
      onClick={() => void openWorkspace()}
      className="group inline-flex max-w-full items-center gap-1 bg-transparent p-0 text-left text-slate-700 transition-colors hover:text-indigo-700"
      title={`Open ${row.schoolName} workspace`}
    >
      <>
        <span className="truncate">{row.schoolName}</span>
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-indigo-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 6H19v5.5M19 5 10 14M5 19h5"
          />
        </svg>
      </>
    </SuperAdminLoadingButton>
  );
}

function ContactFieldValue({
  value,
  missingLabel,
}: {
  value: string | null;
  missingLabel: string;
}) {
  if (value) {
    return <span className="tabular-nums text-slate-700">{value}</span>;
  }
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-amber-50 px-2 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200/80">
      {missingLabel}
    </span>
  );
}

function ContactSourceBadge({ sourceLabel }: { sourceLabel: string }) {
  const { icon, label } = contactSourceDisplay(sourceLabel);

  return (
    <span className="inline-flex items-center gap-1.5 text-slate-700">
      <span className="text-sm leading-none" aria-hidden>
        {icon}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </span>
  );
}

function ContactViewModal({
  row,
  onClose,
}: {
  row: SuperAdminContactRow;
  onClose: () => void;
}) {
  const source = contactSourceDisplay(row.sourceLabel);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-view-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="contact-view-title"
              className="text-lg font-semibold text-slate-900"
            >
              {row.name}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {contactTypeLabel(row)} · {row.schoolName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <DetailRow label="Phone" value={row.phone ?? "Missing phone"} />
          <DetailRow label="Email" value={row.email ?? "Missing email"} />
          <DetailRow label="Source" value={`${source.icon} ${source.label}`} />
          <DetailRow label="Plan" value={binaryPlanLabel(row.schoolPlan)} />
          <DetailRow
            label="Status"
            value={schoolLifecycleStatusLabel(row.schoolStatus)}
          />
          {row.assignedClass ? (
            <DetailRow label="Class" value={row.assignedClass} />
          ) : null}
          {row.linkedStudents ? (
            <DetailRow label="Students" value={row.linkedStudents} />
          ) : null}
        </dl>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-800">{value}</dd>
    </div>
  );
}

function ContactStatusBadge({ row }: { row: SuperAdminContactRow }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-3 text-xs font-semibold ring-1 ring-inset",
        contactSchoolStatusBadgeClass(row.schoolStatus)
      )}
    >
      {schoolLifecycleStatusLabel(row.schoolStatus)}
    </span>
  );
}

function ContactRoleBadge({ row }: { row: SuperAdminContactRow }) {
  return (
    <span
      className={cn(
        saStatusBadge,
        "h-6 px-3 text-xs",
        row.contactType === "admin" && "bg-violet-100 text-violet-900 ring-violet-200",
        row.contactType === "teacher" && "bg-sky-100 text-sky-900 ring-sky-200",
        row.contactType === "parent" && "bg-teal-100 text-teal-900 ring-teal-200"
      )}
    >
      {contactTypeLabel(row)}
    </span>
  );
}

export function ContactTableRow({
  row,
  actionContext,
}: {
  row: SuperAdminContactRow;
  actionContext?: ContactsRowActionContext;
}) {
  return (
    <tr className={cn("border-b border-slate-100 last:border-0", saTableRowHover)}>
      <td className="hidden px-4 py-3.5 md:table-cell">
        <SchoolAvatar name={row.schoolName} logoUrl={row.schoolLogoUrl} />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <SchoolAvatar
            name={row.schoolName}
            logoUrl={row.schoolLogoUrl}
            className="md:hidden"
          />
          <ContactNameBlock row={row} />
        </div>
      </td>
      <td className="hidden px-4 py-3.5 lg:table-cell">
        <ContactRoleBadge row={row} />
      </td>
      <td className="hidden px-4 py-3.5 md:table-cell">
        <SchoolNameLink row={row} />
      </td>
      <td className="hidden px-4 py-3.5 text-slate-700 sm:table-cell">
        {binaryPlanLabel(row.schoolPlan)}
      </td>
      <td className="px-4 py-3.5">
        <ContactStatusBadge row={row} />
      </td>
      <td className="hidden px-4 py-3.5 lg:table-cell">
        <ContactFieldValue value={row.phone} missingLabel="Missing phone" />
      </td>
      <td className="hidden px-4 py-3.5 xl:table-cell">
        <ContactFieldValue value={row.email} missingLabel="Missing email" />
      </td>
      <td className="hidden px-4 py-3.5 2xl:table-cell">
        <ContactSourceBadge sourceLabel={row.sourceLabel} />
      </td>
      <td className="px-4 py-3.5">
        <ContactActionsMenu row={row} actionContext={actionContext} />
      </td>
    </tr>
  );
}

export function ContactMobileCard({
  row,
  actionContext,
}: {
  row: SuperAdminContactRow;
  actionContext?: ContactsRowActionContext;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <SchoolAvatar name={row.schoolName} logoUrl={row.schoolLogoUrl} />
        <div className="min-w-0 flex-1">
          <ContactNameBlock row={row} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ContactRoleBadge row={row} />
            <ContactStatusBadge row={row} />
          </div>
          <p className="mt-2 text-sm">
            <SchoolNameLink row={row} />
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {binaryPlanLabel(row.schoolPlan)}
          </p>
          <div className="mt-1">
            <ContactSourceBadge sourceLabel={row.sourceLabel} />
          </div>
          <div className="mt-3 space-y-1.5 text-sm">
            <p>
              <span className="text-slate-500">Phone:</span>{" "}
              <ContactFieldValue value={row.phone} missingLabel="Missing phone" />
            </p>
            <p className="truncate">
              <span className="text-slate-500">Email:</span>{" "}
              <ContactFieldValue value={row.email} missingLabel="Missing email" />
            </p>
          </div>
          <div className="mt-3">
            <ContactActionsMenu row={row} actionContext={actionContext} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ContactsTableHeader() {
  return (
    <thead className="sticky top-0 z-10">
      <tr className={saTableHeadRow}>
        <th className={cn(saTableHeadCell, "hidden md:table-cell")}>School</th>
        <th className={saTableHeadCell}>Name</th>
        <th className={cn(saTableHeadCell, "hidden lg:table-cell")}>Role</th>
        <th className={cn(saTableHeadCell, "hidden md:table-cell")}>
          School name
        </th>
        <th className={cn(saTableHeadCell, "hidden sm:table-cell")}>Plan</th>
        <th className={saTableHeadCell}>Status</th>
        <th className={cn(saTableHeadCell, "hidden lg:table-cell")}>Phone</th>
        <th className={cn(saTableHeadCell, "hidden xl:table-cell")}>Email</th>
        <th className={cn(saTableHeadCell, "hidden 2xl:table-cell")}>Source</th>
        <th className={saTableHeadCell}>Actions</th>
      </tr>
    </thead>
  );
}
