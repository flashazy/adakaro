"use client";

import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  MoreVertical,
  Printer,
  QrCode,
  Search,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  createCaptureCardUserAction,
  createQuickQrDeskAction,
  deleteCaptureCardUserAction,
  regenerateEnrollmentDeskQrLinkAction,
  resetCaptureCardUserPasswordAction,
  revokeEnrollmentDeskQrAccessAction,
  setCaptureCardUserActiveAction,
} from "./actions";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD in UTC — identical on server and client (avoids locale hydration mismatch). */
function formatDateUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** YYYY-MM-DD HH:mm in UTC — stable for SSR + client. */
function formatDateTimeUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function SimpleDialog({
  open,
  title,
  onClose,
  children,
  maxWidthClass = "max-w-md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`max-h-[90vh] w-full ${maxWidthClass} overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:p-6`}
      >
        <div className="flex items-start justify-between gap-2">
          <h2
            id={titleId}
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export interface CaptureCardUserRow {
  id: string;
  username: string;
  is_active: boolean;
  expires_at: string | null;
  requires_approval: boolean;
  created_at: string;
  is_quick_qr_user: boolean;
  quick_qr_label: string | null;
  quick_qr_note: string | null;
}

function deskHeadline(u: CaptureCardUserRow): string {
  if (u.is_quick_qr_user && u.quick_qr_label?.trim()) {
    return u.quick_qr_label.trim();
  }
  return u.username;
}

function matchesDeskSearch(u: CaptureCardUserRow, q: string): boolean {
  const hay = (
    u.username +
    " " +
    (u.quick_qr_label ?? "") +
    " " +
    (u.quick_qr_note ?? "")
  )
    .toLowerCase();
  return hay.includes(q);
}

export interface QrSuccessDetail {
  accessUrl: string;
  expiresAt: string;
  headline: string;
  requiresApproval: boolean;
  fileSlug: string;
  username?: string;
  password?: string;
}

export interface ActiveQrInfo {
  expires_at: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openEnrollmentDeskQrPrint(
  detail: QrSuccessDetail,
  dataUrl: string | null
): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  const img = dataUrl
    ? `<img src="${dataUrl}" width="300" height="300" alt="" style="display:block;margin:16px auto" />`
    : "<p>QR not available.</p>";
  w.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Desk QR</title></head><body style="font-family:system-ui,-apple-system,sans-serif;padding:24px;text-align:center"><h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(detail.headline)}</h1><p style="font-size:13px;color:#555;margin:0 0 16px">Expires (UTC): ${escapeHtml(formatDateTimeUtc(detail.expiresAt))}</p>${img}</body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
  w.close();
  return true;
}

function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function expiresAtIsoFromPreset(
  preset: "1" | "8" | "24" | "custom",
  customLocal: string
): string {
  if (preset === "1") {
    return new Date(Date.now() + 3600_000).toISOString();
  }
  if (preset === "8") {
    return new Date(Date.now() + 8 * 3600_000).toISOString();
  }
  if (preset === "24") {
    return new Date(Date.now() + 24 * 3600_000).toISOString();
  }
  return new Date(customLocal).toISOString();
}

function isCaptureUserExpired(u: CaptureCardUserRow): boolean {
  return u.expires_at != null && new Date(u.expires_at).getTime() <= Date.now();
}

const QUICK_SOON_MS = 2 * 3600_000;

/** Human-readable relative expiry; used for Quick QR and general copy. */
function formatRelativeExpiry(expiresAt: string | null): string {
  return quickDeskExpiryPhrase(expiresAt);
}

function quickDeskExpiryPhrase(expiresAt: string | null): string {
  if (!expiresAt) return "No expiry";
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return "—";
  const now = Date.now();
  if (t <= now) return "Expired";
  const ms = t - now;

  const exp = new Date(expiresAt);
  const n = new Date();
  const sameLocalDay =
    exp.getFullYear() === n.getFullYear() &&
    exp.getMonth() === n.getMonth() &&
    exp.getDate() === n.getDate();

  if (sameLocalDay) {
    if (ms >= 3600_000) return "Expires today";
    if (ms >= 60_000) return `Expires in ${Math.floor(ms / 60_000)}m`;
    return "Expires soon";
  }

  const d = Math.floor(ms / (24 * 3600_000));
  if (d >= 1) return `Expires in ${d}d`;
  const h = Math.floor(ms / 3600_000);
  if (h >= 1) return `Expires in ${h}h`;
  const m = Math.floor(ms / 60_000);
  if (m >= 1) return `Expires in ${m}m`;
  return "Expires soon";
}

type QuickAccessTone =
  | "healthy"
  | "soon"
  | "expired"
  | "disabled"
  | "no_expiry";

function quickDeskAccessTone(
  u: CaptureCardUserRow,
  phrase: string
): QuickAccessTone {
  const disabled = !u.is_active;
  const expiredByDate =
    u.expires_at != null && new Date(u.expires_at).getTime() <= Date.now();

  if (disabled && expiredByDate) return "expired";
  if (disabled) return "disabled";
  if (expiredByDate || phrase === "Expired") return "expired";
  if (phrase === "No expiry") return "no_expiry";
  const ms = new Date(u.expires_at!).getTime() - Date.now();
  if (ms < QUICK_SOON_MS) return "soon";
  return "healthy";
}

function quickDeskCardSummary(u: CaptureCardUserRow): {
  combinedLine: string;
  tone: QuickAccessTone;
  expiryTitle: string;
} {
  const phrase = quickDeskExpiryPhrase(u.expires_at);
  const disabled = !u.is_active;
  const expiredByDate =
    u.expires_at != null && new Date(u.expires_at).getTime() <= Date.now();
  const expiryTitle = u.expires_at
    ? `${formatDateTimeUtc(u.expires_at)} UTC`
    : "";

  let combinedLine: string;
  if (disabled && expiredByDate) combinedLine = "Disabled · Expired";
  else if (disabled)
    combinedLine = u.expires_at ? `Disabled · ${phrase}` : "Disabled";
  else if (expiredByDate) combinedLine = "Expired";
  else combinedLine = `Active · ${phrase}`;

  const tone = quickDeskAccessTone(u, phrase);

  return { combinedLine, tone, expiryTitle };
}

function quickDeskPrimaryPhraseForTable(u: CaptureCardUserRow): string {
  return quickDeskExpiryPhrase(u.expires_at);
}

function quickDeskAccessCellClasses(tone: QuickAccessTone): string {
  switch (tone) {
    case "healthy":
      return "font-semibold text-emerald-800 dark:text-emerald-200";
    case "soon":
      return "font-semibold text-amber-900 dark:text-amber-100";
    case "expired":
      return "font-semibold text-red-800 dark:text-red-200";
    case "disabled":
      return "font-semibold text-slate-600 dark:text-zinc-400";
    case "no_expiry":
      return "font-semibold text-slate-700 dark:text-zinc-300";
    default:
      return "font-semibold text-slate-800 dark:text-zinc-200";
  }
}

function quickDeskCardPillClasses(tone: QuickAccessTone): string {
  switch (tone) {
    case "healthy":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-800/50";
    case "soon":
      return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/50";
    case "expired":
      return "bg-red-50 text-red-900 ring-1 ring-red-200/80 dark:bg-red-950/45 dark:text-red-100 dark:ring-red-900/40";
    case "disabled":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-300/70 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-600/60";
    case "no_expiry":
      return "bg-slate-50 text-slate-800 ring-1 ring-slate-200/80 dark:bg-zinc-800/80 dark:text-zinc-200 dark:ring-zinc-600/50";
    default:
      return "bg-slate-50 text-slate-800 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-200";
  }
}

function useCloseOnOutsideClick(
  open: boolean,
  onClose: () => void,
  ref: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose, ref]);
}

function statusForUser(u: CaptureCardUserRow): {
  label: string;
  variant: "active" | "disabled" | "expired";
} {
  if (!u.is_active) return { label: "Disabled", variant: "disabled" };
  if (isCaptureUserExpired(u)) return { label: "Expired", variant: "expired" };
  return { label: "Active", variant: "active" };
}

function statusBadgeClass(status: ReturnType<typeof statusForUser>): string {
  return status.variant === "active"
    ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/40"
    : status.variant === "expired"
      ? "bg-red-100 text-red-900 ring-1 ring-red-200/70 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900/45"
      : "bg-slate-200 text-slate-800 ring-1 ring-slate-300/60 dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-600/50";
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type DeskTypeFilter = "all" | "quick" | "manual";
type DeskStatusFilter = "all" | "active" | "disabled" | "expired";

function passesDeskStatusFilter(
  u: CaptureCardUserRow,
  f: DeskStatusFilter
): boolean {
  if (f === "all") return true;
  if (f === "disabled") return !u.is_active;
  if (f === "expired") return isCaptureUserExpired(u);
  return u.is_active && !isCaptureUserExpired(u);
}

function DeskMoreMenu({
  userRow,
  isQuick,
  disabled,
  regenPending,
  revokePending,
  hasActiveQr,
  onResetPassword,
  onDelete,
  onAdvancedDetails,
  onRegenerateQr,
  onRevokeQr,
}: {
  userRow: CaptureCardUserRow;
  isQuick: boolean;
  disabled: boolean;
  regenPending: boolean;
  revokePending: boolean;
  hasActiveQr: boolean;
  onResetPassword: () => void;
  onDelete: () => void;
  onAdvancedDetails: () => void;
  onRegenerateQr?: () => void;
  onRevokeQr?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(open, () => setOpen(false), wrapRef);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        aria-label={`More actions for ${deskHeadline(userRow)}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-30 mt-1 min-w-[13rem] max-w-[min(100vw-2rem,16rem)] rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            className="flex w-full min-h-11 items-center px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => {
              setOpen(false);
              onResetPassword();
            }}
          >
            Reset password
          </button>
          {isQuick ? (
            <button
              type="button"
              role="menuitem"
              disabled={disabled || regenPending}
              className="flex w-full min-h-11 items-center px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => {
                setOpen(false);
                onRegenerateQr?.();
              }}
            >
              Regenerate QR
            </button>
          ) : null}
          {isQuick && hasActiveQr ? (
            <button
              type="button"
              role="menuitem"
              disabled={disabled || revokePending}
              className="flex w-full min-h-11 items-center px-4 py-2.5 text-left text-sm text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-100 dark:hover:bg-amber-950/40"
              onClick={() => {
                setOpen(false);
                onRevokeQr?.();
              }}
            >
              Revoke QR access
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            className="flex w-full min-h-11 items-center px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => {
              setOpen(false);
              onAdvancedDetails();
            }}
          >
            Advanced details
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            className="flex w-full min-h-11 items-center px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ActiveToggle({
  active,
  busy,
  listPending,
  label,
  onToggle,
}: {
  active: boolean;
  busy: boolean;
  listPending: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={listPending}
      onClick={onToggle}
      className={`relative inline-flex h-8 w-[2.875rem] shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-school-primary focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900 ${
        active ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-600"
      }`}
    >
      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70 dark:bg-zinc-900/70">
          <Loader2
            className="h-4 w-4 animate-spin text-slate-700 dark:text-zinc-200"
            aria-hidden
          />
        </span>
      ) : null}
      <span
        className={`pointer-events-none inline-block h-7 w-7 translate-x-0.5 rounded-full bg-white shadow transition-transform ${
          active ? "translate-x-[1.125rem]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

type ListMutationState =
  | null
  | { kind: "toggle"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "resetSave" }
  | { kind: "qrRevoke"; id: string };

export function CaptureCardUsersClient({
  schoolId,
  users,
  activeQrByUserId,
}: {
  schoolId: string;
  users: CaptureCardUserRow[];
  activeQrByUserId: Record<string, ActiveQrInfo>;
}) {
  const router = useRouter();
  const [openCreate, setOpenCreate] = useState(false);
  const [credentials, setCredentials] = useState<{
    username: string;
    password: string;
    loginUrl: string;
  } | null>(null);
  const [createPending, startCreateTransition] = useTransition();
  const [listPending, startListTransition] = useTransition();
  const [listMutation, setListMutation] = useState<ListMutationState>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(
    10
  );
  const [confirmResetUser, setConfirmResetUser] =
    useState<CaptureCardUserRow | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] =
    useState<CaptureCardUserRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [openQuickQr, setOpenQuickQr] = useState(false);
  const [quickDeskLabel, setQuickDeskLabel] = useState("");
  const [quickRequiresApproval, setQuickRequiresApproval] = useState(true);
  const [quickHelperNote, setQuickHelperNote] = useState("");
  const [quickPreset, setQuickPreset] = useState<"1" | "8" | "24" | "custom">(
    "8"
  );
  const [quickCustomExpires, setQuickCustomExpires] = useState("");
  const [quickSubmitPending, startQuickSubmitTransition] = useTransition();

  const [regenerateTarget, setRegenerateTarget] =
    useState<CaptureCardUserRow | null>(null);
  const [regenPreset, setRegenPreset] = useState<"1" | "8" | "24" | "custom">(
    "8"
  );
  const [regenCustomExpires, setRegenCustomExpires] = useState("");
  const [regenPending, startRegenTransition] = useTransition();

  const [viewQrConfirmUser, setViewQrConfirmUser] =
    useState<CaptureCardUserRow | null>(null);

  const [detailUser, setDetailUser] = useState<CaptureCardUserRow | null>(null);

  const [qrSuccessDetail, setQrSuccessDetail] = useState<QrSuccessDetail | null>(
    null
  );
  const [showAdvancedCreds, setShowAdvancedCreds] = useState(false);

  const [typeFilter, setTypeFilter] = useState<DeskTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<DeskStatusFilter>("all");
  const [manualSectionOpen, setManualSectionOpen] = useState(true);

  const filteredDesks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = q ? users.filter((u) => matchesDeskSearch(u, q)) : [...users];
    if (typeFilter === "quick") list = list.filter((u) => u.is_quick_qr_user);
    if (typeFilter === "manual") list = list.filter((u) => !u.is_quick_qr_user);
    list = list.filter((u) => passesDeskStatusFilter(u, statusFilter));
    return list;
  }, [users, searchQuery, typeFilter, statusFilter]);

  const quickDesks = useMemo(
    () => filteredDesks.filter((u) => u.is_quick_qr_user),
    [filteredDesks]
  );
  const manualDesks = useMemo(
    () => filteredDesks.filter((u) => !u.is_quick_qr_user),
    [filteredDesks]
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize, typeFilter, statusFilter]);

  const totalManualFiltered = manualDesks.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalManualFiltered / pageSize) || 1
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!qrSuccessDetail?.accessUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void import("qrcode")
      .then((m) =>
        m.default.toDataURL(qrSuccessDetail.accessUrl, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
        })
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrSuccessDetail?.accessUrl]);

  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageManualUsers = manualDesks.slice(startIdx, startIdx + pageSize);
  const rangeFrom = totalManualFiltered === 0 ? 0 : startIdx + 1;
  const rangeTo = Math.min(startIdx + pageSize, totalManualFiltered);

  function runToggleActive(u: CaptureCardUserRow) {
    setListMutation({ kind: "toggle", id: u.id });
    startListTransition(async () => {
      try {
        const res = await setCaptureCardUserActiveAction(u.id, !u.is_active);
        if (res.error) toast.error(res.error);
        else {
          toast.success(u.is_active ? "Disabled." : "Enabled.");
          refreshList();
        }
      } finally {
        setListMutation(null);
      }
    });
  }

  function runRevokeQr(u: CaptureCardUserRow) {
    setListMutation({ kind: "qrRevoke", id: u.id });
    startListTransition(async () => {
      try {
        const res = await revokeEnrollmentDeskQrAccessAction(u.id);
        if (res.error) toast.error(res.error);
        else {
          toast.success("QR access revoked.");
          refreshList();
        }
      } finally {
        setListMutation(null);
      }
    });
  }

  function openRegenerateQuickDesk(u: CaptureCardUserRow) {
    setRegenerateTarget(u);
    setRegenPreset("8");
    setRegenCustomExpires(
      toDatetimeLocalValue(new Date(Date.now() + 8 * 3600_000))
    );
  }

  function refreshList() {
    router.refresh();
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success("Copied.");
  }

  function closeQrSuccess() {
    setQrSuccessDetail(null);
    setShowAdvancedCreds(false);
    setQrDataUrl(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <p className="max-w-xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          <span className="font-medium text-slate-800 dark:text-zinc-200">
            Quick QR Desk
          </span>{" "}
          is fastest for volunteers: one QR, no passwords to type. Use{" "}
          <span className="font-medium text-slate-800 dark:text-zinc-200">
            Create user
          </span>{" "}
          when you want a named login and password.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[200px]">
          <button
            type="button"
            disabled={createPending || listPending || quickSubmitPending}
            onClick={() => {
              setQuickDeskLabel("");
              setQuickHelperNote("");
              setQuickRequiresApproval(true);
              setQuickPreset("8");
              setQuickCustomExpires(
                toDatetimeLocalValue(new Date(Date.now() + 8 * 3600_000))
              );
              setOpenQuickQr(true);
            }}
            className="min-h-12 w-full rounded-xl bg-school-primary px-4 py-3 text-base font-semibold text-white shadow-sm disabled:opacity-60 sm:min-h-11 sm:text-sm"
          >
            Quick QR Desk
          </button>
          <button
            type="button"
            disabled={createPending || listPending || quickSubmitPending}
            onClick={() => {
              setShowCreatePassword(false);
              setAutoGeneratePassword(true);
              setOpenCreate(true);
            }}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 shadow-sm disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white sm:min-h-11 sm:text-sm"
          >
            Create user
          </button>
        </div>
      </div>

      <section className="space-y-8" aria-labelledby="capture-users-list-heading">
        <h2 id="capture-users-list-heading" className="sr-only">
          Enrollment Desk users
        </h2>
        {users.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            No Enrollment Desk users yet.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="relative max-w-lg">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search desk name, username, or notes…"
                  aria-label="Search enrollment desks"
                  disabled={listPending || createPending || quickSubmitPending}
                  className="w-full min-h-11 rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="flex min-h-11 min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-zinc-400">
                  Desk type
                  <select
                    value={typeFilter}
                    disabled={listPending || createPending || quickSubmitPending}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as DeskTypeFilter)
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="all">All types</option>
                    <option value="quick">Quick QR desks</option>
                    <option value="manual">Manual users</option>
                  </select>
                </label>
                <label className="flex min-h-11 min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-zinc-400">
                  Status
                  <select
                    value={statusFilter}
                    disabled={listPending || createPending || quickSubmitPending}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as DeskStatusFilter)
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="expired">Expired</option>
                  </select>
                </label>
              </div>
            </div>

            {filteredDesks.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                No desks match your search or filters.
              </p>
            ) : (
              <>
                {typeFilter !== "manual" ? (
                  <section className="space-y-3" aria-labelledby="quick-qr-desks-heading">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3
                        id="quick-qr-desks-heading"
                        className="text-base font-semibold tracking-tight text-slate-900 dark:text-white"
                      >
                        Quick QR Desks
                        <span className="ml-2 text-sm font-normal text-slate-500 dark:text-zinc-400">
                          {quickDesks.length}
                        </span>
                      </h3>
                    </div>
                    {quickDesks.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-zinc-400">
                        No Quick QR desks in this view. Create one above or adjust
                        filters.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-3 md:hidden">
                          {quickDesks.map((u) => {
                            const {
                              combinedLine,
                              tone,
                              expiryTitle,
                            } = quickDeskCardSummary(u);
                            return (
                              <div
                                key={u.id}
                                className="rounded-2xl border border-indigo-100/90 bg-gradient-to-b from-indigo-50/80 to-slate-50/40 p-4 shadow-sm dark:border-indigo-900/45 dark:from-indigo-950/35 dark:to-zinc-900/80"
                              >
                                <div className="flex gap-3">
                                  <div
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200"
                                    aria-hidden
                                  >
                                    <QrCode className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-base font-semibold text-slate-900 dark:text-white">
                                          {deskHeadline(u)}
                                        </p>
                                        <p className="mt-0.5 text-xs text-indigo-900/80 dark:text-indigo-200/90">
                                          Temporary QR Desk
                                        </p>
                                      </div>
                                      <span
                                        title={
                                          expiryTitle || undefined
                                        }
                                        className={`max-w-[min(100%,11rem)] shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-semibold leading-snug ${quickDeskCardPillClasses(tone)}`}
                                      >
                                        {combinedLine}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                                      {u.requires_approval
                                        ? "Needs admin approval"
                                        : "No admin approval required"}
                                    </p>
                                    <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                                      Temporary enrollment station — share the QR
                                      with trusted helpers only.
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-indigo-100/80 pt-3 dark:border-indigo-900/40">
                                  <button
                                    type="button"
                                    disabled={listPending || regenPending}
                                    onClick={() => setViewQrConfirmUser(u)}
                                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-school-primary px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 sm:flex-none sm:min-h-11"
                                  >
                                    <QrCode className="h-4 w-4 shrink-0" aria-hidden />
                                    Open QR
                                  </button>
                                  <div className="flex min-h-12 items-center gap-2">
                                    <span className="sr-only">Account active</span>
                                    <ActiveToggle
                                      active={u.is_active}
                                      busy={
                                        listMutation?.kind === "toggle" &&
                                        listMutation.id === u.id
                                      }
                                      listPending={listPending}
                                      label={
                                        u.is_active
                                          ? `Disable ${deskHeadline(u)}`
                                          : `Enable ${deskHeadline(u)}`
                                      }
                                      onToggle={() => runToggleActive(u)}
                                    />
                                  </div>
                                  <DeskMoreMenu
                                    userRow={u}
                                    isQuick
                                    disabled={
                                      listPending ||
                                      createPending ||
                                      quickSubmitPending
                                    }
                                    regenPending={regenPending}
                                    revokePending={
                                      listMutation?.kind === "qrRevoke" &&
                                      listMutation.id === u.id &&
                                      listPending
                                    }
                                    hasActiveQr={!!activeQrByUserId[u.id]}
                                    onResetPassword={() => setConfirmResetUser(u)}
                                    onDelete={() => setConfirmDeleteUser(u)}
                                    onAdvancedDetails={() => setDetailUser(u)}
                                    onRegenerateQr={() => openRegenerateQuickDesk(u)}
                                    onRevokeQr={() => runRevokeQr(u)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="hidden overflow-x-auto rounded-xl border border-indigo-100/90 bg-white shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900 md:block">
                          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-indigo-50/50 dark:border-indigo-900/35 dark:bg-indigo-950/20">
                                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                  Desk
                                </th>
                                <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                  Access
                                </th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {quickDesks.map((u) => {
                                const phrase = quickDeskPrimaryPhraseForTable(u);
                                const status = statusForUser(u);
                                const tone = quickDeskAccessTone(
                                  u,
                                  quickDeskExpiryPhrase(u.expires_at)
                                );
                                const secondaryMeta = `${status.label} · Created ${formatDateUtc(u.created_at)}`;
                                const expiryTitle = u.expires_at
                                  ? `${formatDateTimeUtc(u.expires_at)} UTC`
                                  : "";
                                return (
                                  <tr
                                    key={u.id}
                                    className="border-b border-slate-100 last:border-0 dark:border-zinc-800"
                                  >
                                    <td className="max-w-[240px] px-4 py-3 align-middle">
                                      <div className="flex gap-2">
                                        <div
                                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-200"
                                          aria-hidden
                                        >
                                          <QrCode className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-medium text-slate-900 dark:text-white">
                                            {deskHeadline(u)}
                                          </p>
                                          <p className="text-xs text-indigo-800/90 dark:text-indigo-200/85">
                                            Temporary QR Desk
                                          </p>
                                          <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
                                            {u.requires_approval
                                              ? "Needs admin approval"
                                              : "No admin approval"}
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                      <p
                                        title={expiryTitle || undefined}
                                        className={quickDeskAccessCellClasses(
                                          tone
                                        )}
                                      >
                                        {phrase}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                                        {secondaryMeta}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                      <div className="flex flex-wrap items-center justify-end gap-2">
                                        <ActiveToggle
                                          active={u.is_active}
                                          busy={
                                            listMutation?.kind === "toggle" &&
                                            listMutation.id === u.id
                                          }
                                          listPending={listPending}
                                          label={
                                            u.is_active
                                              ? `Disable ${deskHeadline(u)}`
                                              : `Enable ${deskHeadline(u)}`
                                          }
                                          onToggle={() => runToggleActive(u)}
                                        />
                                        <button
                                          type="button"
                                          disabled={listPending || regenPending}
                                          onClick={() => setViewQrConfirmUser(u)}
                                          className="inline-flex min-h-10 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg bg-school-primary px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
                                        >
                                          <QrCode className="h-3.5 w-3.5" aria-hidden />
                                          Open QR
                                        </button>
                                        <DeskMoreMenu
                                          userRow={u}
                                          isQuick
                                          disabled={
                                            listPending ||
                                            createPending ||
                                            quickSubmitPending
                                          }
                                          regenPending={regenPending}
                                          revokePending={
                                            listMutation?.kind === "qrRevoke" &&
                                            listMutation.id === u.id &&
                                            listPending
                                          }
                                          hasActiveQr={!!activeQrByUserId[u.id]}
                                          onResetPassword={() =>
                                            setConfirmResetUser(u)
                                          }
                                          onDelete={() => setConfirmDeleteUser(u)}
                                          onAdvancedDetails={() =>
                                            setDetailUser(u)
                                          }
                                          onRegenerateQr={() =>
                                            openRegenerateQuickDesk(u)
                                          }
                                          onRevokeQr={() => runRevokeQr(u)}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </section>
                ) : null}

                {typeFilter !== "quick" ? (
                  <section
                    className="space-y-4 border-t border-slate-200/80 pt-8 dark:border-zinc-800"
                    aria-labelledby="manual-desk-users-heading"
                  >
                    <button
                      type="button"
                      className="flex w-full min-h-12 items-center justify-between gap-2 rounded-xl text-left text-slate-900 transition-colors hover:bg-slate-50 dark:text-white dark:hover:bg-zinc-800/80"
                      onClick={() => setManualSectionOpen((v) => !v)}
                      aria-expanded={manualSectionOpen}
                    >
                      <h3
                        id="manual-desk-users-heading"
                        className="text-base font-semibold tracking-tight"
                      >
                        Manual Enrollment Desk Users
                        <span className="ml-2 text-sm font-normal text-slate-500 dark:text-zinc-400">
                          {manualDesks.length}
                        </span>
                      </h3>
                      <ChevronRight
                        className={`h-5 w-5 shrink-0 text-slate-500 transition-transform dark:text-zinc-400 ${manualSectionOpen ? "rotate-90" : ""}`}
                        aria-hidden
                      />
                    </button>

                    {manualSectionOpen ? (
                      <>
                        {manualDesks.length === 0 ? (
                          <p className="text-sm text-slate-600 dark:text-zinc-400">
                            No manual users in this view. Add one with Create user
                            or adjust filters.
                          </p>
                        ) : (
                          <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                              <label
                                htmlFor="cc-users-page-size"
                                className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-zinc-400"
                              >
                                <span>Rows per page (manual)</span>
                                <select
                                  id="cc-users-page-size"
                                  value={pageSize}
                                  disabled={
                                    listPending ||
                                    createPending ||
                                    quickSubmitPending
                                  }
                                  onChange={(e) => {
                                    setPageSize(
                                      Number(
                                        e.target.value
                                      ) as (typeof PAGE_SIZE_OPTIONS)[number]
                                    );
                                  }}
                                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                >
                                  {PAGE_SIZE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-zinc-400">
                              Showing{" "}
                              {totalManualFiltered === 0
                                ? "0"
                                : `${rangeFrom}–${rangeTo}`}{" "}
                              of {totalManualFiltered} users
                            </p>

                            <div className="space-y-3 md:hidden">
                              {pageManualUsers.map((u) => {
                                const status = statusForUser(u);
                                return (
                                  <div
                                    key={u.id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                                  >
                                    <div className="flex gap-3">
                                      <div
                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                                        aria-hidden
                                      >
                                        <User className="h-5 w-5" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <p className="text-base font-semibold text-slate-900 dark:text-white">
                                            {u.username}
                                          </p>
                                          <span
                                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(status)}`}
                                          >
                                            {status.label}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                                          Staff account · created{" "}
                                          {formatDateUtc(u.created_at)}
                                        </p>
                                        {u.expires_at ? (
                                          <p
                                            className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500"
                                            title={`${formatDateTimeUtc(u.expires_at)} UTC`}
                                          >
                                            Expires:{" "}
                                            {formatRelativeExpiry(u.expires_at)}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
                                      <div className="flex min-h-12 items-center gap-2">
                                        <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                                          Account
                                        </span>
                                        <ActiveToggle
                                          active={u.is_active}
                                          busy={
                                            listMutation?.kind === "toggle" &&
                                            listMutation.id === u.id
                                          }
                                          listPending={listPending}
                                          label={
                                            u.is_active
                                              ? `Disable ${u.username}`
                                              : `Enable ${u.username}`
                                          }
                                          onToggle={() => runToggleActive(u)}
                                        />
                                      </div>
                                      <DeskMoreMenu
                                        userRow={u}
                                        isQuick={false}
                                        disabled={
                                          listPending ||
                                          createPending ||
                                          quickSubmitPending
                                        }
                                        regenPending={regenPending}
                                        revokePending={false}
                                        hasActiveQr={false}
                                        onResetPassword={() =>
                                          setConfirmResetUser(u)
                                        }
                                        onDelete={() => setConfirmDeleteUser(u)}
                                        onAdvancedDetails={() =>
                                          setDetailUser(u)
                                        }
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:block">
                              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                                    <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                      User
                                    </th>
                                    <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                      Created
                                    </th>
                                    <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                      Status
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pageManualUsers.map((u) => {
                                    const status = statusForUser(u);
                                    return (
                                      <tr
                                        key={u.id}
                                        className="border-b border-slate-100 last:border-0 dark:border-zinc-800"
                                      >
                                        <td className="px-4 py-3 align-middle">
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                                              aria-hidden
                                            >
                                              <User className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="font-medium text-slate-900 dark:text-white">
                                                {u.username}
                                              </p>
                                              <p className="text-xs text-slate-500 dark:text-zinc-500">
                                                Long-term staff login
                                              </p>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 align-middle font-mono text-slate-700 dark:text-zinc-300">
                                          <span>{formatDateUtc(u.created_at)}</span>
                                          {u.expires_at ? (
                                            <span
                                              className="mt-1 block font-sans text-xs font-normal text-slate-500 dark:text-zinc-500"
                                              title={`${formatDateTimeUtc(u.expires_at)} UTC`}
                                            >
                                              {formatRelativeExpiry(u.expires_at)}
                                            </span>
                                          ) : null}
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                          <span
                                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(status)}`}
                                          >
                                            {status.label}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                          <div className="flex flex-wrap items-center justify-end gap-2">
                                            <ActiveToggle
                                              active={u.is_active}
                                              busy={
                                                listMutation?.kind === "toggle" &&
                                                listMutation.id === u.id
                                              }
                                              listPending={listPending}
                                              label={
                                                u.is_active
                                                  ? `Disable ${u.username}`
                                                  : `Enable ${u.username}`
                                              }
                                              onToggle={() => runToggleActive(u)}
                                            />
                                            <DeskMoreMenu
                                              userRow={u}
                                              isQuick={false}
                                              disabled={
                                                listPending ||
                                                createPending ||
                                                quickSubmitPending
                                              }
                                              regenPending={regenPending}
                                              revokePending={false}
                                              hasActiveQr={false}
                                              onResetPassword={() =>
                                                setConfirmResetUser(u)
                                              }
                                              onDelete={() =>
                                                setConfirmDeleteUser(u)
                                              }
                                              onAdvancedDetails={() =>
                                                setDetailUser(u)
                                              }
                                            />
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-zinc-800">
                              <button
                                type="button"
                                disabled={
                                  listPending || createPending || safePage <= 1
                                }
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                Previous
                              </button>
                              <span className="text-sm text-slate-500 dark:text-zinc-400">
                                Page {safePage} of {totalPages}
                              </span>
                              <button
                                type="button"
                                disabled={
                                  listPending ||
                                  createPending ||
                                  safePage >= totalPages
                                }
                                onClick={() =>
                                  setPage((p) => Math.min(totalPages, p + 1))
                                }
                                className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                Next
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    ) : null}
                  </section>
                ) : null}
              </>
            )}
          </>
        )}
      </section>

      <SimpleDialog
        open={detailUser != null}
        title="Advanced details"
        onClose={() => setDetailUser(null)}
        maxWidthClass="max-w-md"
      >
        {detailUser ? (
          <dl className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                {detailUser.is_quick_qr_user ? "Desk name" : "Username"}
              </dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
                {detailUser.is_quick_qr_user
                  ? deskHeadline(detailUser)
                  : detailUser.username}
              </dd>
            </div>
            {detailUser.is_quick_qr_user ? (
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                  Internal username
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-800 dark:text-zinc-200">
                  {detailUser.username}
                </dd>
              </div>
            ) : null}
            {detailUser.quick_qr_note?.trim() ? (
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                  Note
                </dt>
                <dd className="mt-0.5 text-slate-800 dark:text-zinc-200">
                  {detailUser.quick_qr_note.trim()}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                Approval for new students
              </dt>
              <dd className="mt-0.5">
                {detailUser.requires_approval ? "Required" : "Not required"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                Account expiry
              </dt>
              <dd className="mt-0.5 font-mono text-xs">
                {detailUser.expires_at
                  ? `${formatDateTimeUtc(detailUser.expires_at)} UTC`
                  : "No expiry"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                Created
              </dt>
              <dd className="mt-0.5 font-mono text-xs">
                {formatDateUtc(detailUser.created_at)}
              </dd>
            </div>
          </dl>
        ) : null}
      </SimpleDialog>

      <SimpleDialog
        open={openQuickQr}
        title="Quick QR Desk"
        onClose={() => {
          if (!quickSubmitPending) {
            setOpenQuickQr(false);
          }
        }}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-base text-slate-800 dark:text-zinc-200 sm:text-sm">
          <p className="text-slate-600 dark:text-zinc-400">
            We will create a short-term desk and a scan link. Helpers do not need
            a password if they use the QR.
          </p>
          <label className="block">
            <span className="font-medium text-slate-900 dark:text-white">
              Desk name
            </span>
            <input
              value={quickDeskLabel}
              onChange={(e) => setQuickDeskLabel(e.target.value)}
              disabled={quickSubmitPending}
              placeholder="e.g. Reception, Desk 1"
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white sm:min-h-10"
            />
          </label>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-900 dark:text-white">
              How long is this desk open?
            </legend>
            {(
              [
                ["1", "1 hour"],
                ["8", "8 hours"],
                ["24", "24 hours"],
                ["custom", "Pick date and time"],
              ] as const
            ).map(([val, label]) => (
              <label
                key={val}
                className="flex min-h-11 cursor-pointer items-center gap-3 py-1 sm:min-h-0"
              >
                <input
                  type="radio"
                  name="quick-qr-preset"
                  checked={quickPreset === val}
                  onChange={() => {
                    setQuickPreset(val);
                    if (val === "1") {
                      setQuickCustomExpires(
                        toDatetimeLocalValue(new Date(Date.now() + 3600_000))
                      );
                    } else if (val === "8") {
                      setQuickCustomExpires(
                        toDatetimeLocalValue(
                          new Date(Date.now() + 8 * 3600_000)
                        )
                      );
                    } else if (val === "24") {
                      setQuickCustomExpires(
                        toDatetimeLocalValue(
                          new Date(Date.now() + 24 * 3600_000)
                        )
                      );
                    }
                  }}
                  disabled={quickSubmitPending}
                  className="h-4 w-4"
                />
                {label}
              </label>
            ))}
          </fieldset>
          {quickPreset === "custom" ? (
            <label className="block">
              <span className="font-medium text-slate-900 dark:text-white">
                Ends at
              </span>
              <input
                type="datetime-local"
                value={quickCustomExpires}
                onChange={(e) => setQuickCustomExpires(e.target.value)}
                disabled={quickSubmitPending}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white sm:min-h-10"
              />
            </label>
          ) : null}
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-1 sm:min-h-0">
            <input
              type="checkbox"
              checked={quickRequiresApproval}
              onChange={(e) => setQuickRequiresApproval(e.target.checked)}
              disabled={quickSubmitPending}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="font-medium text-slate-900 dark:text-white">
                New students need admin approval
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-500">
                Turn off only if you fully trust this helper.
              </span>
            </span>
          </label>
          <label className="block">
            <span className="font-medium text-slate-900 dark:text-white">
              Note (optional)
            </span>
            <textarea
              value={quickHelperNote}
              onChange={(e) => setQuickHelperNote(e.target.value)}
              disabled={quickSubmitPending}
              placeholder="e.g. For intake today"
              rows={2}
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </label>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={quickSubmitPending}
              onClick={() => setOpenQuickQr(false)}
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-600 sm:min-h-10"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={quickSubmitPending}
              onClick={() => {
                startQuickSubmitTransition(async () => {
                  const res = await createQuickQrDeskAction({
                    deskLabel: quickDeskLabel,
                    expiresAtIso: expiresAtIsoFromPreset(
                      quickPreset,
                      quickCustomExpires
                    ),
                    requiresApproval: quickRequiresApproval,
                    helperNote: quickHelperNote,
                  });
                  if ("error" in res) {
                    toast.error(res.error);
                    return;
                  }
                  const fileSlug =
                    res.deskLabel.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(
                      0,
                      48
                    ) || "quick-desk";
                  setQrSuccessDetail({
                    accessUrl: res.accessUrl,
                    expiresAt: res.expiresAt,
                    headline: res.deskLabel,
                    requiresApproval: res.requiresApproval,
                    fileSlug,
                    username: res.username,
                    password: res.password,
                  });
                  setShowAdvancedCreds(false);
                  setOpenQuickQr(false);
                  refreshList();
                  toast.success("Desk ready — show the QR to your helper.");
                });
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:min-h-10"
            >
              {quickSubmitPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                "Generate QR access"
              )}
            </button>
          </div>
        </div>
      </SimpleDialog>

      <SimpleDialog
        open={regenerateTarget != null}
        title="Regenerate QR"
        onClose={() => {
          if (!regenPending) {
            setRegenerateTarget(null);
          }
        }}
        maxWidthClass="max-w-md"
      >
        {regenerateTarget ? (
          <div className="space-y-4 text-base text-slate-800 dark:text-zinc-200 sm:text-sm">
            <p className="text-slate-600 dark:text-zinc-400">
              Any link that has not been scanned yet will stop working. Desk:{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {deskHeadline(regenerateTarget)}
              </span>
            </p>
            <fieldset className="space-y-3">
              <legend className="sr-only">New link duration</legend>
              {(
                [
                  ["1", "1 hour"],
                  ["8", "8 hours"],
                  ["24", "24 hours"],
                  ["custom", "Custom date and time"],
                ] as const
              ).map(([val, label]) => (
                <label
                  key={val}
                  className="flex min-h-11 cursor-pointer items-center gap-3 py-1 sm:min-h-0"
                >
                  <input
                    type="radio"
                    name="regen-preset"
                    checked={regenPreset === val}
                    onChange={() => {
                      setRegenPreset(val);
                      if (val === "1") {
                        setRegenCustomExpires(
                          toDatetimeLocalValue(new Date(Date.now() + 3600_000))
                        );
                      } else if (val === "8") {
                        setRegenCustomExpires(
                          toDatetimeLocalValue(
                            new Date(Date.now() + 8 * 3600_000)
                          )
                        );
                      } else if (val === "24") {
                        setRegenCustomExpires(
                          toDatetimeLocalValue(
                            new Date(Date.now() + 24 * 3600_000)
                          )
                        );
                      }
                    }}
                    disabled={regenPending}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {regenPreset === "custom" ? (
              <label className="block">
                <span className="font-medium text-slate-900 dark:text-white">
                  Ends at
                </span>
                <input
                  type="datetime-local"
                  value={regenCustomExpires}
                  onChange={(e) => setRegenCustomExpires(e.target.value)}
                  disabled={regenPending}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white sm:min-h-10"
                />
              </label>
            ) : null}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={regenPending}
                onClick={() => setRegenerateTarget(null)}
                className="min-h-11 rounded-lg border border-slate-300 px-4 py-2.5 text-sm dark:border-zinc-600 sm:min-h-10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={regenPending}
                onClick={() => {
                  const row = regenerateTarget;
                  const iso = expiresAtIsoFromPreset(
                    regenPreset,
                    regenCustomExpires
                  );
                  startRegenTransition(async () => {
                    const res = await regenerateEnrollmentDeskQrLinkAction(
                      row.id,
                      iso
                    );
                    if ("error" in res) {
                      toast.error(res.error);
                      return;
                    }
                    const fileSlug = deskHeadline(row)
                      .replace(/[^a-zA-Z0-9_-]+/g, "_")
                      .slice(0, 48)
                      || row.username.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(
                          0,
                          48
                        )
                      || "desk";
                    setQrSuccessDetail({
                      accessUrl: res.accessUrl,
                      expiresAt: res.expiresAt,
                      headline: deskHeadline(row),
                      requiresApproval: row.requires_approval,
                      fileSlug,
                    });
                    setShowAdvancedCreds(false);
                    setRegenerateTarget(null);
                    refreshList();
                    toast.success("New link ready.");
                  });
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:min-h-10"
              >
                {regenPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Working…
                  </>
                ) : (
                  "Create QR link"
                )}
              </button>
            </div>
          </div>
        ) : null}
      </SimpleDialog>

      <SimpleDialog
        open={viewQrConfirmUser != null}
        title="Open QR"
        onClose={() => setViewQrConfirmUser(null)}
        maxWidthClass="max-w-md"
      >
        {viewQrConfirmUser ? (
          <div className="space-y-5 text-base text-slate-800 dark:text-zinc-200 sm:text-sm">
            <p className="leading-relaxed text-slate-600 dark:text-zinc-400">
              For security, scan links are only shown once. To put a fresh QR on
              this desk, we will create a new link. Any old link that has not
              been scanned yet will stop working.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setViewQrConfirmUser(null)}
                className="min-h-12 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium dark:border-zinc-600 sm:min-h-11"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = viewQrConfirmUser;
                  setViewQrConfirmUser(null);
                  setRegenerateTarget(u);
                  setRegenPreset("8");
                  setRegenCustomExpires(
                    toDatetimeLocalValue(new Date(Date.now() + 8 * 3600_000))
                  );
                }}
                className="min-h-12 rounded-xl bg-school-primary px-4 py-3 text-sm font-semibold text-white shadow-sm sm:min-h-11"
              >
                Create new QR link
              </button>
            </div>
          </div>
        ) : null}
      </SimpleDialog>

      <SimpleDialog
        open={qrSuccessDetail != null}
        title="Desk link ready"
        onClose={() => {
          closeQrSuccess();
        }}
        maxWidthClass="max-w-lg"
      >
        {qrSuccessDetail ? (
          <div className="space-y-6 text-base text-slate-800 dark:text-zinc-200 sm:text-sm">
            <div className="rounded-2xl bg-slate-50/80 px-4 py-5 text-center dark:bg-zinc-800/50 sm:px-6">
              <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                {qrSuccessDetail.headline}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                  Link active
                </span>
                <span className="inline-flex rounded-full bg-slate-200/80 px-3 py-1 text-xs font-medium text-slate-800 dark:bg-zinc-700 dark:text-zinc-200">
                  {qrSuccessDetail.requiresApproval
                    ? "Needs admin approval"
                    : "No admin approval"}
                </span>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700 dark:text-zinc-300">
                {formatRelativeExpiry(qrSuccessDetail.expiresAt)}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500 dark:text-zinc-500">
                {formatDateTimeUtc(qrSuccessDetail.expiresAt)} UTC
              </p>
            </div>
            <p className="text-center text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
              Share this QR or link only with people you trust at the desk.
            </p>
            <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-inner dark:border-zinc-700 sm:p-8">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode
                <img
                  src={qrDataUrl}
                  alt="Enrollment desk QR code"
                  width={320}
                  height={320}
                  className="mx-auto max-h-[min(65vh,340px)] w-full max-w-[280px] sm:max-w-[320px]"
                />
              ) : (
                <Loader2
                  className="h-10 w-10 animate-spin text-slate-400"
                  aria-hidden
                />
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => copy(qrSuccessDetail.accessUrl)}
                className="min-h-12 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium dark:border-zinc-600 sm:min-h-11"
              >
                Copy link
              </button>
              {qrDataUrl ? (
                <a
                  href={qrDataUrl}
                  download={`enrollment-desk-qr-${qrSuccessDetail.fileSlug}.png`}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-medium dark:border-zinc-600 sm:min-h-11"
                >
                  Download QR
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!openEnrollmentDeskQrPrint(qrSuccessDetail, qrDataUrl)) {
                    toast.error("Allow pop-ups to print.");
                  }
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium dark:border-zinc-600 sm:min-h-11"
              >
                <Printer className="h-4 w-4 shrink-0" aria-hidden />
                Print QR
              </button>
              <button
                type="button"
                onClick={closeQrSuccess}
                className="min-h-12 rounded-xl bg-school-primary px-4 py-3 text-sm font-semibold text-white sm:min-h-11"
              >
                Done
              </button>
            </div>
            {qrSuccessDetail.username && qrSuccessDetail.password ? (
              <details
                className="rounded-xl border border-slate-200 dark:border-zinc-700"
                open={showAdvancedCreds}
                onToggle={(e) =>
                  setShowAdvancedCreds(e.currentTarget.open)
                }
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-medium text-slate-800 dark:text-zinc-200 sm:px-4 [&::-webkit-details-marker]:hidden">
                  Advanced details
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                </summary>
                <div className="space-y-3 border-t border-slate-100 px-3 py-3 text-sm dark:border-zinc-800 sm:px-4">
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    Only for troubleshooting. Prefer sharing the QR or link.
                  </p>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-zinc-800/80">
                    <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                      Username
                    </p>
                    <code className="mt-1 block break-all text-slate-900 dark:text-white">
                      {qrSuccessDetail.username}
                    </code>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-zinc-800/80">
                    <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                      Password
                    </p>
                    <code className="mt-1 block break-all text-slate-900 dark:text-white">
                      {qrSuccessDetail.password}
                    </code>
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </SimpleDialog>

      <SimpleDialog
        open={openCreate}
        title="Create Enrollment Desk user"
        onClose={() => {
          if (!createPending) {
            setShowCreatePassword(false);
            setAutoGeneratePassword(true);
            setOpenCreate(false);
          }
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            startCreateTransition(async () => {
              const res = await createCaptureCardUserAction(fd);
              if ("error" in res) {
                toast.error(res.error);
                return;
              }
              form.reset();
              setShowCreatePassword(false);
              setAutoGeneratePassword(true);
              setOpenCreate(false);
              setCredentials({
                username: res.username,
                password: res.password,
                loginUrl: res.loginUrl,
              });
              toast.success("User created.");
              refreshList();
            });
          }}
        >
          <label className="block text-sm">
            <span className="font-medium text-slate-900 dark:text-white">
              Username
            </span>
            <input
              name="username"
              required
              disabled={createPending}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="auto_password"
              value="1"
              checked={autoGeneratePassword}
              disabled={createPending}
              onChange={(e) => {
                setAutoGeneratePassword(e.target.checked);
                if (e.target.checked) setShowCreatePassword(false);
              }}
            />
            Generate a strong password automatically
          </label>
          {!autoGeneratePassword ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-900 dark:text-white">
                Temporary password
              </span>
              <div className="relative mt-1">
                <input
                  name="password"
                  type={showCreatePassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  disabled={createPending}
                  className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-11 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={createPending}
                  onClick={() => setShowCreatePassword((v) => !v)}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label={
                    showCreatePassword ? "Hide password" : "Show password"
                  }
                  aria-pressed={showCreatePassword}
                >
                  {showCreatePassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="font-medium text-slate-900 dark:text-white">
              Expiry (optional)
            </span>
            <input
              name="expires_at"
              type="datetime-local"
              disabled={createPending}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="requires_approval"
              value="1"
              defaultChecked
              disabled={createPending}
            />
            Require admin approval for new students
          </label>
          <p className="text-xs text-amber-900 dark:text-amber-100">
            {autoGeneratePassword
              ? "A strong password will be generated for you. Save it in the next step — you will only see it once."
              : "Save the password somewhere safe — you will only see it once in the next step."}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={createPending}
              onClick={() => {
                setShowCreatePassword(false);
                setAutoGeneratePassword(true);
                setOpenCreate(false);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {createPending ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </SimpleDialog>

      <SimpleDialog
        open={credentials != null}
        title="Save these details"
        onClose={() => setCredentials(null)}
      >
        {credentials ? (
          <div className="space-y-3 text-sm text-slate-800 dark:text-zinc-200">
            <p className="text-amber-900 dark:text-amber-100">
              Copy and share securely. Anyone with these details can capture
              students for your school.
            </p>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-zinc-800">
              <p className="font-medium">Username</p>
              <div className="flex gap-2">
                <code className="flex-1 break-all">{credentials.username}</code>
                <button
                  type="button"
                  onClick={() => copy(credentials.username)}
                  className="shrink-0 text-school-primary"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-zinc-800">
              <p className="font-medium">Password</p>
              <div className="flex gap-2">
                <code className="flex-1 break-all">{credentials.password}</code>
                <button
                  type="button"
                  onClick={() => copy(credentials.password)}
                  className="shrink-0 text-school-primary"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-zinc-800">
              <p className="font-medium">Login link</p>
              <div className="flex gap-2">
                <code className="flex-1 break-all text-xs">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}${credentials.loginUrl}`
                    : credentials.loginUrl}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    copy(
                      typeof window !== "undefined"
                        ? `${window.location.origin}${credentials.loginUrl}`
                        : credentials.loginUrl
                    )
                  }
                  className="shrink-0 text-school-primary"
                >
                  Copy
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              School code (also in the link):{" "}
              <code className="font-mono">{schoolId}</code>
            </p>
            <button
              type="button"
              onClick={() => setCredentials(null)}
              className="w-full rounded-lg bg-school-primary py-2 font-semibold text-white"
            >
              Done
            </button>
          </div>
        ) : null}
      </SimpleDialog>

      <SimpleDialog
        open={confirmResetUser != null}
        title="Reset password"
        onClose={() => setConfirmResetUser(null)}
      >
        {confirmResetUser ? (
          <div className="space-y-4 text-sm text-slate-700 dark:text-zinc-300">
            <p>
              Continue to set a new password for{" "}
              <strong className="text-slate-900 dark:text-white">
                {confirmResetUser.username}
              </strong>
              ? You will enter the new password on the next step.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmResetUser(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = confirmResetUser;
                  setConfirmResetUser(null);
                  setResetId(u.id);
                  setResetPassword("");
                  setShowResetPassword(false);
                }}
                className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}
      </SimpleDialog>

      <SimpleDialog
        open={confirmDeleteUser != null}
        title="Delete user"
        onClose={() => {
          if (!listPending) setConfirmDeleteUser(null);
        }}
      >
        {confirmDeleteUser ? (
          <div className="space-y-4 text-sm text-slate-700 dark:text-zinc-300">
            <p>
              Delete{" "}
              <strong className="text-slate-900 dark:text-white">
                {deskHeadline(confirmDeleteUser)}
              </strong>
              ? They will lose access immediately. This cannot be undone.
            </p>
            {confirmDeleteUser.is_quick_qr_user ? (
              <p className="text-xs text-slate-500 dark:text-zinc-500">
                Internal username:{" "}
                <span className="font-mono">{confirmDeleteUser.username}</span>
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={listPending}
                onClick={() => setConfirmDeleteUser(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={listPending}
                onClick={() => {
                  const id = confirmDeleteUser.id;
                  setListMutation({ kind: "delete", id });
                  startListTransition(async () => {
                    try {
                      const res = await deleteCaptureCardUserAction(id);
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      setConfirmDeleteUser(null);
                      toast.success("Deleted.");
                      refreshList();
                    } finally {
                      setListMutation(null);
                    }
                  });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {listMutation?.kind === "delete" &&
                listMutation.id === confirmDeleteUser.id &&
                listPending ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        ) : null}
      </SimpleDialog>

      <SimpleDialog
        open={resetId != null}
        title={
          resetId
            ? `Reset password · ${users.find((x) => x.id === resetId)?.username ?? ""}`
            : "Reset password"
        }
        onClose={() => {
          if (!listPending) {
            setResetId(null);
            setShowResetPassword(false);
          }
        }}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!resetId) return;
            const id = resetId;
            setListMutation({ kind: "resetSave" });
            startListTransition(async () => {
              try {
                const res = await resetCaptureCardUserPasswordAction(
                  id,
                  resetPassword
                );
                if (res.error) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Password updated.");
                setResetId(null);
                setResetPassword("");
                setShowResetPassword(false);
                refreshList();
                if (res.password) {
                  setCredentials({
                    username: users.find((x) => x.id === id)?.username ?? "",
                    password: res.password,
                    loginUrl: `/capture-card/login?school=${encodeURIComponent(schoolId)}`,
                  });
                }
              } finally {
                setListMutation(null);
              }
            });
          }}
        >
          <div className="relative">
            <input
              type={showResetPassword ? "text" : "password"}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="New password (8+ characters)"
              disabled={listPending}
              className="w-full rounded-lg border border-slate-200 py-2 pl-3 pr-11 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              disabled={listPending}
              onClick={() => setShowResetPassword((v) => !v)}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label={
                showResetPassword ? "Hide password" : "Show password"
              }
              aria-pressed={showResetPassword}
            >
              {showResetPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={listPending}
              onClick={() => {
                setResetId(null);
                setShowResetPassword(false);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={listPending}
              className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {listMutation?.kind === "resetSave" && listPending ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </SimpleDialog>
    </div>
  );
}
