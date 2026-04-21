"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const HREF_PROFILES = "/teacher-dashboard/students";
const HREF_REPORTS = "/teacher-dashboard/academic-reports";

function pathIsUnderAcademicNav(pathname: string): boolean {
  return (
    pathname === HREF_PROFILES ||
    pathname.startsWith(`${HREF_PROFILES}/`) ||
    pathname === HREF_REPORTS ||
    pathname.startsWith(`${HREF_REPORTS}/`)
  );
}

function linkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TeacherAcademicNavDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const sectionActive = pathIsUnderAcademicNav(pathname);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const triggerClass = [
    "touch-manipulation inline-flex min-h-[40px] min-w-[40px] items-center gap-0.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:min-w-0",
    sectionActive
      ? "bg-school-primary text-white dark:bg-school-primary"
      : "text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  ].join(" ");

  const itemClass = (href: string) =>
    [
      "block rounded-md px-3 py-2.5 text-sm sm:py-2",
      linkActive(pathname, href)
        ? "bg-slate-100 font-semibold text-school-primary dark:bg-zinc-800 dark:text-school-primary"
        : "text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
    ].join(" ");

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Academic menu"
        onClick={() => setOpen((v) => !v)}
      >
        Academic
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-[60] mt-1 w-max min-w-[13rem] max-w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:end-auto sm:start-0 dark:border-zinc-600 dark:bg-zinc-900"
        >
          <Link
            href={HREF_PROFILES}
            role="menuitem"
            className={itemClass(HREF_PROFILES)}
            onClick={() => setOpen(false)}
          >
            Student profiles
          </Link>
          <Link
            href={HREF_REPORTS}
            role="menuitem"
            className={itemClass(HREF_REPORTS)}
            onClick={() => setOpen(false)}
          >
            Academic reports
          </Link>
        </div>
      ) : null}
    </div>
  );
}
