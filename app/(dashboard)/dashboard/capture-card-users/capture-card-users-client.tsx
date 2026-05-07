"use client";

import { Eye, EyeOff, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  createCaptureCardUserAction,
  deleteCaptureCardUserAction,
  resetCaptureCardUserPasswordAction,
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
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
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
}

function isCaptureUserExpired(u: CaptureCardUserRow): boolean {
  return (
    u.expires_at != null && new Date(u.expires_at).getTime() <= Date.now()
  );
}

function statusForUser(u: CaptureCardUserRow): {
  label: string;
  variant: "active" | "disabled" | "expired";
} {
  if (!u.is_active) return { label: "Disabled", variant: "disabled" };
  if (isCaptureUserExpired(u)) return { label: "Expired", variant: "expired" };
  return { label: "Active", variant: "active" };
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type ListMutationState =
  | null
  | { kind: "toggle"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "resetSave" };

export function CaptureCardUsersClient({
  schoolId,
  users,
}: {
  schoolId: string;
  users: CaptureCardUserRow[];
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

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q));
  }, [users, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize]);

  const totalFiltered = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageUsers = filteredUsers.slice(startIdx, startIdx + pageSize);
  const rangeFrom = totalFiltered === 0 ? 0 : startIdx + 1;
  const rangeTo = Math.min(startIdx + pageSize, totalFiltered);

  function refreshList() {
    router.refresh();
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success("Copied.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Share the login link with each helper. They need the school code from
          the link, plus their username and password.
        </p>
        <button
          type="button"
          disabled={createPending}
          onClick={() => {
            setShowCreatePassword(false);
            setAutoGeneratePassword(true);
            setOpenCreate(true);
          }}
          className="rounded-xl bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Create user
        </button>
      </div>

      <section className="space-y-4" aria-labelledby="capture-users-list-heading">
        <h2 id="capture-users-list-heading" className="sr-only">
          Enrollment Desk users
        </h2>
        {users.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            No Enrollment Desk users yet.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="relative max-w-md flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username…"
                  aria-label="Search by username"
                  disabled={listPending || createPending}
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                <label htmlFor="cc-users-page-size" className="shrink-0">
                  Rows per page
                </label>
                <select
                  id="cc-users-page-size"
                  value={pageSize}
                  disabled={listPending || createPending}
                  onChange={(e) => {
                    setPageSize(
                      Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]
                    );
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {totalFiltered === 0 ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                No users match your search.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  Showing {rangeFrom}–{rangeTo} of {totalFiltered} users
                </p>

                <div className="space-y-3 md:hidden">
                  {pageUsers.map((u) => {
                    const status = statusForUser(u);
                    const statusClass =
                      status.variant === "active"
                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                        : status.variant === "expired"
                          ? "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                          : "bg-slate-200 text-slate-800 dark:bg-zinc-700 dark:text-zinc-200";
                    return (
                      <div
                        key={u.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {u.username}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-zinc-500">
                              {u.requires_approval
                                ? "Approval required for new students"
                                : "Approval not required"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <dl className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500 dark:text-zinc-500">
                              Created
                            </dt>
                            <dd className="font-mono text-slate-800 dark:text-zinc-200">
                              {formatDateUtc(u.created_at)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500 dark:text-zinc-500">
                              Expiry
                            </dt>
                            <dd className="font-mono text-slate-800 dark:text-zinc-200">
                              {u.expires_at
                                ? formatDateTimeUtc(u.expires_at)
                                : "No expiry"}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                              Account
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={u.is_active}
                              aria-label={
                                u.is_active
                                  ? "Disable capture user"
                                  : "Enable capture user"
                              }
                              disabled={listPending}
                              onClick={() => {
                                setListMutation({ kind: "toggle", id: u.id });
                                startListTransition(async () => {
                                  try {
                                    const res =
                                      await setCaptureCardUserActiveAction(
                                        u.id,
                                        !u.is_active
                                      );
                                    if (res.error) toast.error(res.error);
                                    else {
                                      toast.success(
                                        u.is_active ? "Disabled." : "Enabled."
                                      );
                                      refreshList();
                                    }
                                  } finally {
                                    setListMutation(null);
                                  }
                                });
                              }}
                              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-school-primary focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900 ${
                                u.is_active
                                  ? "bg-emerald-500"
                                  : "bg-slate-300 dark:bg-zinc-600"
                              }`}
                            >
                              {listMutation?.kind === "toggle" &&
                              listMutation.id === u.id ? (
                                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70 dark:bg-zinc-900/70">
                                  <Loader2
                                    className="h-4 w-4 animate-spin text-slate-700 dark:text-zinc-200"
                                    aria-hidden
                                  />
                                </span>
                              ) : null}
                              <span
                                className={`pointer-events-none inline-block h-6 w-6 translate-x-0.5 rounded-full bg-white shadow transition-transform ${
                                  u.is_active
                                    ? "translate-x-[1.375rem]"
                                    : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={listPending}
                              onClick={() => setConfirmResetUser(u)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-600"
                            >
                              {listMutation?.kind === "resetSave" && listPending ? (
                                <Loader2
                                  className="h-3.5 w-3.5 shrink-0 animate-spin"
                                  aria-hidden
                                />
                              ) : null}
                              Reset password
                            </button>
                            <button
                              type="button"
                              disabled={listPending}
                              onClick={() => setConfirmDeleteUser(u)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-800 disabled:opacity-50 dark:border-red-900 dark:text-red-200"
                            >
                              {listMutation?.kind === "delete" &&
                              listMutation.id === u.id &&
                              listPending ? (
                                <Loader2
                                  className="h-3.5 w-3.5 shrink-0 animate-spin"
                                  aria-hidden
                                />
                              ) : null}
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:block">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                        <th
                          scope="col"
                          className="px-4 py-3 font-semibold text-slate-900 dark:text-white"
                        >
                          Username
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 font-semibold text-slate-900 dark:text-white"
                        >
                          Created
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 font-semibold text-slate-900 dark:text-white"
                        >
                          Expiry
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 font-semibold text-slate-900 dark:text-white"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageUsers.map((u) => {
                        const status = statusForUser(u);
                        const statusClass =
                          status.variant === "active"
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                            : status.variant === "expired"
                              ? "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                              : "bg-slate-200 text-slate-800 dark:bg-zinc-700 dark:text-zinc-200";
                        return (
                          <tr
                            key={u.id}
                            className="border-b border-slate-100 last:border-0 dark:border-zinc-800"
                          >
                            <td className="px-4 py-3 align-middle">
                              <p className="font-medium text-slate-900 dark:text-white">
                                {u.username}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-zinc-500">
                                {u.requires_approval
                                  ? "Approval on"
                                  : "Approval off"}
                              </p>
                            </td>
                            <td className="px-4 py-3 align-middle font-mono text-slate-700 dark:text-zinc-300">
                              {formatDateUtc(u.created_at)}
                            </td>
                            <td className="px-4 py-3 align-middle font-mono text-slate-700 dark:text-zinc-300">
                              {u.expires_at
                                ? formatDateTimeUtc(u.expires_at)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={u.is_active}
                                  aria-label={
                                    u.is_active
                                      ? `Disable ${u.username}`
                                      : `Enable ${u.username}`
                                  }
                                  disabled={listPending}
                                  onClick={() => {
                                    setListMutation({ kind: "toggle", id: u.id });
                                    startListTransition(async () => {
                                      try {
                                        const res =
                                          await setCaptureCardUserActiveAction(
                                            u.id,
                                            !u.is_active
                                          );
                                        if (res.error) toast.error(res.error);
                                        else {
                                          toast.success(
                                            u.is_active
                                              ? "Disabled."
                                              : "Enabled."
                                          );
                                          refreshList();
                                        }
                                      } finally {
                                        setListMutation(null);
                                      }
                                    });
                                  }}
                                  className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-school-primary focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900 ${
                                    u.is_active
                                      ? "bg-emerald-500"
                                      : "bg-slate-300 dark:bg-zinc-600"
                                  }`}
                                >
                                  {listMutation?.kind === "toggle" &&
                                  listMutation.id === u.id ? (
                                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70 dark:bg-zinc-900/70">
                                      <Loader2
                                        className="h-4 w-4 animate-spin text-slate-700 dark:text-zinc-200"
                                        aria-hidden
                                      />
                                    </span>
                                  ) : null}
                                  <span
                                    className={`pointer-events-none inline-block h-6 w-6 translate-x-0.5 rounded-full bg-white shadow transition-transform ${
                                      u.is_active
                                        ? "translate-x-[1.375rem]"
                                        : "translate-x-0"
                                    }`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  disabled={listPending}
                                  onClick={() => setConfirmResetUser(u)}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-zinc-600"
                                >
                                  {listMutation?.kind === "resetSave" &&
                                  listPending ? (
                                    <Loader2
                                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                                      aria-hidden
                                    />
                                  ) : null}
                                  Reset password
                                </button>
                                <button
                                  type="button"
                                  disabled={listPending}
                                  onClick={() => setConfirmDeleteUser(u)}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-800 disabled:opacity-50 dark:border-red-900 dark:text-red-200"
                                >
                                  {listMutation?.kind === "delete" &&
                                  listMutation.id === u.id &&
                                  listPending ? (
                                    <Loader2
                                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                                      aria-hidden
                                    />
                                  ) : null}
                                  Delete
                                </button>
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
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-500 dark:text-zinc-400">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={
                      listPending || createPending || safePage >= totalPages
                    }
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>

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
        title="Delete capture user"
        onClose={() => {
          if (!listPending) setConfirmDeleteUser(null);
        }}
      >
        {confirmDeleteUser ? (
          <div className="space-y-4 text-sm text-slate-700 dark:text-zinc-300">
            <p>
              Delete{" "}
              <strong className="text-slate-900 dark:text-white">
                {confirmDeleteUser.username}
              </strong>
              ? They will lose access immediately. This cannot be undone.
            </p>
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
