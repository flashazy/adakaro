"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  full_name: string;
  admission_number: string | null;
}

interface BaseProps {
  name: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
}

interface ClassPickerProps extends BaseProps {
  kind: "class";
  options: ClassOption[];
}

interface StudentPickerProps extends BaseProps {
  kind: "student";
  options: StudentOption[];
}

type FeeStructureTargetPickerProps = ClassPickerProps | StudentPickerProps;

function normalizeClassLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  if (trimmed === trimmed.toUpperCase() && /[a-zA-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return trimmed;
}

function studentMatchesQuery(student: StudentOption, query: string): boolean {
  const q = query.toLowerCase();
  return (
    student.full_name.toLowerCase().includes(q) ||
    (student.admission_number?.toLowerCase().includes(q) ?? false) ||
    student.id.toLowerCase().includes(q)
  );
}

function classMatchesQuery(option: ClassOption, query: string): boolean {
  const q = query.toLowerCase();
  return (
    option.name.toLowerCase().includes(q) ||
    normalizeClassLabel(option.name).toLowerCase().includes(q)
  );
}

export function FeeStructureTargetPicker(props: FeeStructureTargetPickerProps) {
  const { name, required = false, defaultValue = "", className } = props;
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(defaultValue);

  const filteredClasses = useMemo(() => {
    if (props.kind !== "class") return [];
    const q = search.trim();
    if (!q) return props.options;
    return props.options.filter((option) => classMatchesQuery(option, q));
  }, [props, search]);

  const filteredStudents = useMemo(() => {
    if (props.kind !== "student") return [];
    const q = search.trim();
    if (!q) return props.options;
    return props.options.filter((student) => studentMatchesQuery(student, q));
  }, [props, search]);

  const items =
    props.kind === "class" ? filteredClasses : filteredStudents;

  const selectedItemClass =
    "bg-[rgb(var(--school-primary-rgb)/0.1)] dark:bg-[rgb(var(--school-primary-rgb)/0.16)]";

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div
          className="max-h-[300px] overflow-y-auto overscroll-contain"
          role="listbox"
          aria-label={props.kind === "class" ? "Classes" : "Students"}
        >
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  props.kind === "class"
                    ? "Search classes..."
                    : "Search by name, admission no., or ID..."
                }
                aria-label={
                  props.kind === "class" ? "Search classes" : "Search students"
                }
                className="w-full border-0 bg-transparent py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                No matching results
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Try another name, class or admission number
              </p>
            </div>
          ) : props.kind === "class" ? (
            filteredClasses.map((option) => {
              const isSelected = selectedId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelectedId(option.id)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-b-0 dark:border-zinc-700/80",
                    isSelected
                      ? selectedItemClass
                      : "hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                  )}
                >
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-white">
                    {normalizeClassLabel(option.name)}
                  </span>
                  {isSelected ? (
                    <Check
                      className="h-4 w-4 shrink-0 text-school-primary"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })
          ) : (
            filteredStudents.map((student) => {
              const isSelected = selectedId === student.id;
              return (
                <button
                  key={student.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelectedId(student.id)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-b-0 dark:border-zinc-700/80",
                    isSelected
                      ? selectedItemClass
                      : "hover:bg-slate-50 dark:hover:bg-zinc-700/50"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">
                      {student.full_name}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">
                      {student.admission_number
                        ? `Admission No: ${student.admission_number}`
                        : "Admission No: —"}
                    </span>
                  </span>
                  {isSelected ? (
                    <Check
                      className="h-4 w-4 shrink-0 self-center text-school-primary"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>

      <input type="hidden" name={name} value={selectedId} required={required} />
    </div>
  );
}
