"use client";

import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

const HREF_STUDENT_REPORTS = "/teacher-dashboard/students";
const HREF_ACADEMIC_REPORTS = "/teacher-dashboard/academic-reports";

function pathIsUnderAcademicNav(pathname: string): boolean {
  return (
    pathname === HREF_STUDENT_REPORTS ||
    pathname.startsWith(`${HREF_STUDENT_REPORTS}/`) ||
    pathname === HREF_ACADEMIC_REPORTS ||
    pathname.startsWith(`${HREF_ACADEMIC_REPORTS}/`)
  );
}

function linkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type MenuCoords = {
  top: number;
  left?: number;
  right?: number;
};

export function TeacherAcademicNavDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sectionActive = pathIsUnderAcademicNav(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const sm = vw >= 640;
    const pad = 8;
    const menuMaxPx = Math.min(18 * 16, vw - pad * 2);
    const gap = 8;
    const top = r.bottom + gap;

    if (sm) {
      const maxLeft = vw - menuMaxPx - pad;
      const left = Math.max(pad, Math.min(r.left, maxLeft));
      setMenuCoords({ top, left });
    } else {
      const right = Math.max(pad, vw - r.right);
      setMenuCoords({ top, right });
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuCoords(null);
      return;
    }
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
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

  const academicActiveBar =
    "after:pointer-events-none after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-[min(50%,10rem)] after:-translate-x-1/2 after:rounded-full after:bg-school-primary";

  const triggerClass = [
    "touch-manipulation relative inline-flex shrink-0 min-h-[44px] items-center gap-1 whitespace-nowrap rounded-md px-3 pb-3 text-sm font-medium transition-colors duration-200",
    sectionActive
      ? `text-school-primary font-semibold dark:text-school-primary ${academicActiveBar}`
      : "text-slate-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  ].join(" ");

  const itemClass = (href: string) => {
    const base =
      "flex min-h-[44px] items-center px-4 py-2 text-sm transition-colors duration-200 outline-none sm:min-h-0";
    return linkActive(pathname, href)
      ? `${base} cursor-default bg-gray-100 font-semibold text-school-primary dark:bg-zinc-800 dark:text-school-primary`
      : `${base} cursor-pointer text-slate-700 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800 focus-visible:bg-gray-100 dark:focus-visible:bg-zinc-800`;
  };

  const menuClassName =
    "w-max min-w-[13rem] max-w-[min(18rem,calc(100vw-1rem))] rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-slate-900/12 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/45";

  const menu =
    open && mounted && typeof document !== "undefined" && menuCoords ? (
      <div
        ref={menuRef}
        role="menu"
        className={menuClassName}
        style={{
          position: "fixed",
          top: menuCoords.top,
          left: menuCoords.left,
          right: menuCoords.right,
          zIndex: 100,
        }}
      >
        <NavLinkWithLoading
          href={HREF_STUDENT_REPORTS}
          role="menuitem"
          className={itemClass(HREF_STUDENT_REPORTS)}
          onClick={() => setOpen(false)}
        >
          Student reports
        </NavLinkWithLoading>
        <NavLinkWithLoading
          href={HREF_ACADEMIC_REPORTS}
          role="menuitem"
          className={itemClass(HREF_ACADEMIC_REPORTS)}
          onClick={() => setOpen(false)}
        >
          Academic reports
        </NavLinkWithLoading>
      </div>
    ) : null;

  return (
    <>
      <div className="relative shrink-0" ref={wrapRef}>
        <button
          type="button"
          className={triggerClass}
          aria-expanded={open}
          aria-haspopup="menu"
          data-state={open ? "open" : "closed"}
          aria-label="Academic menu"
          onClick={() => setOpen((v) => !v)}
        >
          Academic
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            data-state={open ? "open" : "closed"}
            aria-hidden
          />
        </button>
      </div>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}
