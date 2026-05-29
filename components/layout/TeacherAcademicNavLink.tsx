"use client";

import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { usePathname } from "next/navigation";
import {
  ACADEMIC_HUB,
  pathIsUnderAcademicSection,
} from "@/lib/academic/academic-hub-paths";

const academicActiveBar =
  "after:pointer-events-none after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-[min(50%,10rem)] after:-translate-x-1/2 after:rounded-full after:bg-school-primary";

export function TeacherAcademicNavLink() {
  const pathname = usePathname();
  const active = pathIsUnderAcademicSection(pathname);

  const className = [
    "relative inline-flex shrink-0 min-h-[44px] items-center whitespace-nowrap rounded-md px-3 pb-3 text-sm font-medium transition-colors duration-200",
    active
      ? `text-school-primary font-semibold dark:text-school-primary ${academicActiveBar}`
      : "text-slate-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  ].join(" ");

  return (
    <NavLinkWithLoading href={ACADEMIC_HUB} className={className}>
      Academic
    </NavLinkWithLoading>
  );
}
