"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, Copy, X } from "lucide-react";
import type { ParentCredentialSheetPayload } from "@/lib/parent-credential-sheet-types";

export interface ParentCredentialsModalProps {
  open: boolean;
  sheet: ParentCredentialSheetPayload | null;
  onClose: () => void;
  /** Optional logo URL shown on screen and print slip */
  schoolLogoUrl?: string | null;
}

function loginUrlDisplay(sheet: ParentCredentialSheetPayload): string {
  if (sheet.kind !== "new") return "";
  const fromServer = sheet.loginUrl?.trim();
  if (fromServer) return fromServer;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/login`;
  }
  return "/login";
}

export function ParentCredentialsModal({
  open,
  sheet,
  onClose,
  schoolLogoUrl,
}: ParentCredentialsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open && sheet) {
      setRendered(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setRendered(false), 200);
    return () => window.clearTimeout(t);
  }, [open, sheet]);

  useEffect(() => {
    if (!open || !rendered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rendered, onClose]);

  const copyText = useMemo(() => {
    if (!sheet) return "";
    const lines: string[] = [];
    lines.push("Parent Portal Login");
    lines.push(`School: ${sheet.schoolName}`);
    lines.push(`Student: ${sheet.studentName}`);
    lines.push(`Admission number: ${sheet.admissionNumber}`);
    lines.push(`Parent: ${sheet.parentName}`);
    lines.push(`Parent phone: ${sheet.parentPhoneDisplay}`);
    if (sheet.kind === "new") {
      lines.push(`Username: ${sheet.username}`);
      lines.push(`Temporary password: ${sheet.temporaryPassword}`);
      lines.push(`Login: ${loginUrlDisplay(sheet)}`);
      lines.push("");
      lines.push("Please change this password after your first login.");
    } else {
      lines.push("");
      lines.push(sheet.message);
    }
    return lines.join("\n");
  }, [sheet]);

  async function copyCredentials() {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      // ignore
    }
  }

  function printSlip() {
    window.print();
  }

  if (!mounted || !rendered || !sheet) {
    return null;
  }

  const node = (
    <div
      className="parent-credentials-modal-root fixed inset-0 z-[220] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className={`no-print absolute inset-0 bg-black/50 transition-opacity duration-200 dark:bg-black/70 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`parent-credentials-print-scope relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl transition-all duration-200 dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl ${
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-credentials-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="no-print flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <h2
              id="parent-credentials-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Parent Login Credentials
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              {sheet.kind === "new"
                ? "Give this slip to the parent or guardian. The temporary password is shown only here."
                : "Existing parent account found"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="no-print shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="parent-credentials-slip rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-700 dark:bg-zinc-950/40">
            <div className="flex flex-col items-center gap-2 border-b border-slate-200 pb-4 text-center dark:border-zinc-700">
              {schoolLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={schoolLogoUrl}
                  alt=""
                  className="h-12 w-auto max-w-[200px] object-contain"
                />
              ) : null}
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {sheet.schoolName}
              </p>
              <p className="text-sm font-semibold uppercase tracking-wide text-school-primary">
                Parent Portal Login
              </p>
            </div>

            <dl className="mt-4 space-y-2 text-sm text-slate-800 dark:text-zinc-200">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-zinc-400">Student</dt>
                <dd className="text-right font-medium">{sheet.studentName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-zinc-400">
                  Admission number
                </dt>
                <dd className="text-right font-mono font-medium">
                  {sheet.admissionNumber}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-zinc-400">Parent</dt>
                <dd className="text-right font-medium">{sheet.parentName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-zinc-400">
                  Parent phone
                </dt>
                <dd className="text-right font-mono">{sheet.parentPhoneDisplay}</dd>
              </div>

              {sheet.kind === "new" ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Username
                    </dt>
                    <dd className="text-right font-mono font-semibold">
                      {sheet.username}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Temporary password
                    </dt>
                    <dd className="text-right font-mono font-semibold">
                      {sheet.temporaryPassword}
                    </dd>
                  </div>
                  <div className="border-t border-slate-200 pt-3 dark:border-zinc-700">
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Login URL
                    </dt>
                    <dd className="mt-1 break-all font-mono text-xs text-school-primary">
                      {loginUrlDisplay(sheet)}
                    </dd>
                  </div>
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                    This temporary password must be changed on first login.
                  </p>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    Please change this password after your first login.
                  </p>
                </>
              ) : (
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
                  <p className="font-medium text-slate-900 dark:text-white">
                    Existing parent account found
                  </p>
                  <p className="mt-1">{sheet.message}</p>
                  <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
                    No password is shown because this parent already has a login.
                  </p>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="no-print flex flex-col gap-2 border-t border-slate-100 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end">
          {sheet.kind === "new" ? (
            <>
              <button
                type="button"
                onClick={printSlip}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <Printer className="h-4 w-4 shrink-0" aria-hidden />
                Print credentials
              </button>
              <button
                type="button"
                onClick={() => void copyCredentials()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <Copy className="h-4 w-4 shrink-0" aria-hidden />
                Copy credentials
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white hover:brightness-105"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
