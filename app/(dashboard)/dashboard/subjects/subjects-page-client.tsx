"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { BackButton } from "@/components/dashboard/back-button";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  assignSubjectClassesAction,
  bulkCreateSubjectsAction,
  createSubjectAction,
  deleteSubjectAction,
  updateSubjectAction,
  type SubjectActionState,
  type SubjectRow,
} from "./actions";
import {
  formatNativeSelectClassOptionLabel,
  sortClassRowsByHierarchy,
} from "@/lib/class-options";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";
import {
  DASHBOARD_SUBJECTS_ROWS_STORAGE_KEY,
  parseStudentListRowsPerPage,
  STUDENT_LIST_ROW_OPTIONS,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";
import {
  generateSubjectCodeDisplay,
  parseSubjectCodeNumericSuffix,
  subjectCodePrefixFromName,
} from "@/lib/subject-code";

/** Default auto code from subject name (first 3 letters of name + `-101`). */
export function generateSubjectCode(name: string): string {
  return generateSubjectCodeDisplay(name);
}

export { parseSubjectCodeNumericSuffix, subjectCodePrefixFromName };

function applyAutoSubjectCodeIfEmpty(form: HTMLFormElement) {
  const codeInput = form.elements.namedItem("code") as HTMLInputElement | null;
  const nameInput = form.elements.namedItem("name") as HTMLInputElement | null;
  if (!codeInput || !nameInput) return;
  const code = codeInput.value.trim();
  const subjectName = nameInput.value.trim();
  if (!code && subjectName) {
    codeInput.value = generateSubjectCode(subjectName);
  }
}

function flash(state: SubjectActionState | null) {
  if (!state) return null;
  if (state.ok && state.message) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
        {state.message}
      </p>
    );
  }
  if (!state.ok) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
        {state.error}
      </p>
    );
  }
  return null;
}

interface SubjectsPageClientProps {
  initialRows: SubjectRow[];
  classOptions: { id: string; name: string; parent_class_id: string | null }[];
}

function EditSubjectModalContent({
  editing,
  updateState,
  updatePending,
  updateAction,
  classOptions,
  onClose,
}: {
  editing: SubjectRow;
  updateState: SubjectActionState | null;
  updatePending: boolean;
  updateAction: (payload: FormData) => void;
  classOptions: SubjectsPageClientProps["classOptions"];
  onClose: () => void;
}) {
  const codeSuffixRef = useRef(
    parseSubjectCodeNumericSuffix(editing.code ?? "")
  );
  const codeTouchedRef = useRef(false);
  const [editName, setEditName] = useState(editing.name);
  const [editCode, setEditCode] = useState(
    () => (editing.code ?? "").trim()
  );

  useEffect(() => {
    if (codeTouchedRef.current) return;
    if (editName === editing.name) return;
    const prefix = subjectCodePrefixFromName(editName);
    setEditCode(`${prefix}-${codeSuffixRef.current}`);
  }, [editName, editing.name]);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3
          id="edit-subject-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Edit subject
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-primary-rgb)/0.4)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
      <form
        action={updateAction}
        className="mt-4 space-y-3"
        onSubmit={(e) => applyAutoSubjectCodeIfEmpty(e.currentTarget)}
      >
        {flash(updateState)}
        <input type="hidden" name="id" value={editing.id} />
        <label className="block text-sm">
          <span className="text-slate-700 dark:text-zinc-300">Name</span>
          <input
            name="name"
            type="text"
            required
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700 dark:text-zinc-300">
            Code (optional)
          </span>
          <input
            name="code"
            type="text"
            value={editCode}
            onChange={(e) => {
              codeTouchedRef.current = true;
              setEditCode(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700 dark:text-zinc-300">
            Description (optional)
          </span>
          <textarea
            name="description"
            rows={3}
            defaultValue={editing.description ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          />
        </label>
        <div className="block text-sm">
          <span className="text-slate-700 dark:text-zinc-300">
            Assign to classes
          </span>
          {classOptions.length === 0 ? (
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              No classes yet. Add classes first.
            </p>
          ) : (
            <SubjectClassPicker
              key={editing.id}
              classOptions={classOptions}
              defaultSelectedIds={editing.assignedClassIds}
            />
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updatePending}
            className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
          >
            {updatePending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </>
  );
}

/** Searchable multi-select with checkboxes; submits `subject_ids` via hidden inputs. */
function ExistingSubjectsMultiPicker({
  subjects,
  selectedIds,
  onSelectedIdsChange,
}: {
  subjects: SubjectRow[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter((s) => {
      if (selectedSet.has(s.id)) return true;
      const hay = [s.name, s.code ?? "", s.description ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [subjects, query, selectedSet]);

  /** Clear search only when the user clears all ticked subjects (not on every mount). */
  const prevSelectionCount = useRef<number | null>(null);
  useEffect(() => {
    const len = selectedIds.length;
    if (
      prevSelectionCount.current !== null &&
      len === 0 &&
      prevSelectionCount.current > 0
    ) {
      setQuery("");
    }
    prevSelectionCount.current = len;
  }, [selectedIds.length]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="subject_ids" value={id} />
      ))}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
          strokeWidth={2}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subjects..."
          autoComplete="off"
          aria-label="Search subjects"
          aria-controls={listboxId}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/20 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-school-primary dark:focus:ring-school-primary/20"
        />
      </div>
      <div
        id={listboxId}
        role="group"
        aria-label="Subjects"
        className="max-h-[12.5rem] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
      >
        {subjects.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-slate-500 dark:text-zinc-400">
            No subjects.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-slate-500 dark:text-zinc-400">
            No matching subjects.
          </p>
        ) : (
          filtered.map((s) => {
            const checked = selectedSet.has(s.id);
            return (
              <label
                key={s.id}
                className={`flex min-h-10 cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  checked
                    ? "bg-[rgb(var(--school-primary-rgb)/0.10)]/80 dark:bg-[rgb(var(--school-primary-rgb)/0.12)]"
                    : "hover:bg-slate-100 dark:hover:bg-zinc-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-school-primary"
                />
                <span
                  className={
                    checked
                      ? "font-medium text-school-primary dark:text-school-primary"
                      : "text-slate-800 dark:text-zinc-100"
                  }
                >
                  {s.name}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function SubjectClassPicker({
  classOptions,
  defaultSelectedIds,
}: {
  classOptions: { id: string; name: string; parent_class_id: string | null }[];
  defaultSelectedIds?: string[];
}) {
  const listboxId = useId();
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    (defaultSelectedIds ?? []).filter((id) =>
      classOptions.some((c) => c.id === id)
    )
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const pillItems = useMemo(() => {
    const rows = selectedIds
      .map((id) => classOptions.find((c) => c.id === id))
      .filter(
        (c): c is { id: string; name: string; parent_class_id: string | null } =>
          c != null
      );
    return sortClassRowsByHierarchy(rows);
  }, [selectedIds, classOptions]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = classOptions
      .filter((c) => !selectedSet.has(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q));
    return sortClassRowsByHierarchy(pool);
  }, [classOptions, selectedSet, query]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  function addClass(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setQuery("");
    setOpen(false);
  }

  function removeClass(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  const canAddMore = classOptions.some((c) => !selectedSet.has(c.id));

  return (
    <div ref={containerRef} className="relative z-10 mt-2 space-y-3 overflow-visible">
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="class_ids" value={id} />
      ))}

      <div>
        <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
          Selected classes
        </p>
        {pillItems.length === 0 ? (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-zinc-500">
            No classes selected yet.
          </p>
        ) : (
          <ul
            className="mt-2 flex flex-wrap gap-2"
            aria-label="Selected classes"
          >
            {pillItems.map((c) => (
              <li key={c.id}>
                <span
                  className={`inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pr-1 text-sm font-medium text-slate-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 ${
                    c.parent_class_id ? "pl-5" : "pl-3"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => removeClass(c.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
                    aria-label={`Remove ${c.name}`}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative">
        <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
          Add more classes
        </p>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search or select a class..."
          disabled={!canAddMore}
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-school-primary dark:focus:ring-school-primary/20"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
        />
        {open && canAddMore ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-[110] mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          >
            {available.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-slate-500 dark:text-zinc-400">
                {query.trim()
                  ? "No matching classes."
                  : "All classes are already selected."}
              </p>
            ) : (
              available.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  className={`w-full py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-zinc-800 ${
                    c.parent_class_id ? "pl-8 pr-3" : "px-3"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addClass(c.id)}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SubjectsPageClient({
  initialRows,
  classOptions,
}: SubjectsPageClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [addMode, setAddMode] = useState<"existing" | "new">("new");
  const [multipleSubjectIds, setMultipleSubjectIds] = useState<string[]>([]);
  /** Bump to remount subject pickers + class picker (clears local search / class chips). */
  const [assignFormResetNonce, setAssignFormResetNonce] = useState(0);
  const assignWasPendingRef = useRef(false);

  const [createState, createAction, createPending] = useActionState(
    createSubjectAction,
    null as SubjectActionState | null
  );
  const [assignState, assignAction, assignPending] = useActionState(
    assignSubjectClassesAction,
    null as SubjectActionState | null
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateSubjectAction,
    null as SubjectActionState | null
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSubjectAction,
    null as SubjectActionState | null
  );
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateSubjectsAction,
    null as SubjectActionState | null
  );

  useLayoutEffect(() => {
    if (deleteState?.ok) {
      setDeleting(null);
    }
  }, [deleteState]);

  useEffect(() => {
    if (
      createState?.ok ||
      assignState?.ok ||
      updateState?.ok ||
      deleteState?.ok ||
      bulkState?.ok
    ) {
      router.refresh();
    }
  }, [createState, assignState, updateState, deleteState, bulkState, router]);

  useEffect(() => {
    if (!bulkOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBulkOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [bulkOpen]);

  const closeEditModal = () => setEditing(null);

  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editing]);

  const rows = initialRows;

  useEffect(() => {
    setMultipleSubjectIds((prev) =>
      prev.filter((id) => rows.some((r) => r.id === id))
    );
  }, [rows]);

  useEffect(() => {
    if (rows.length === 0 && addMode === "existing") {
      setAddMode("new");
    }
  }, [rows.length, addMode]);

  const assignClassPickerDefaults = useMemo(() => {
    if (multipleSubjectIds.length !== 1) return [];
    return (
      rows.find((r) => r.id === multipleSubjectIds[0])?.assignedClassIds ?? []
    );
  }, [rows, multipleSubjectIds]);

  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(5);

  useEffect(() => {
    const stored = parseStudentListRowsPerPage(
      localStorage.getItem(DASHBOARD_SUBJECTS_ROWS_STORAGE_KEY)
    );
    if (stored != null) setRowsPerPage(stored);
  }, []);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        classFilter !== "all" &&
        !r.assignedClassIds.includes(classFilter)
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        r.name,
        r.code ?? "",
        r.description ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, searchQuery, classFilter]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));

  useEffect(() => {
    setPage(1);
  }, [searchQuery, classFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const pagedRows = filteredRows.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  const isFiltering = searchQuery.trim().length > 0 || classFilter !== "all";
  const showingFrom = totalCount === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + rowsPerPage, totalCount);
  const paginationItems = getCompactPaginationItems(safePage, totalPages);

  /** Clears chosen subjects and remounts pickers (class chips + search inputs). */
  const resetAssignFormLayout = useCallback(() => {
    setMultipleSubjectIds([]);
    setAssignFormResetNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (
      assignWasPendingRef.current &&
      !assignPending &&
      assignState?.ok
    ) {
      resetAssignFormLayout();
    }
    assignWasPendingRef.current = assignPending;
  }, [assignPending, assignState, resetAssignFormLayout]);

  const clearFilters = () => {
    setSearchQuery("");
    setClassFilter("all");
  };

  return (
    <div className="space-y-10">
      <div>
        <BackButton
          href="/dashboard"
          className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          ← Back to dashboard
        </BackButton>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Add subject
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Map catalog subjects to classes, or create new subjects for teacher
          assignments.
        </p>

        <fieldset className="mt-5 space-y-2 border-0 p-0">
          <legend className="text-sm font-medium text-slate-800 dark:text-zinc-200">
            Choose subject source
          </legend>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="radio"
              className="h-4 w-4 border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-school-primary"
              checked={addMode === "existing"}
              disabled={rows.length === 0}
              onChange={() => {
                setAddMode("existing");
              }}
            />
            <span
              className={
                rows.length === 0
                  ? "text-sm text-slate-400 dark:text-zinc-500"
                  : "text-sm text-slate-700 dark:text-zinc-300"
              }
            >
              Select existing subject(s)
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="radio"
              className="h-4 w-4 border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-school-primary"
              checked={addMode === "new"}
              onChange={() => {
                setAddMode("new");
                setMultipleSubjectIds([]);
              }}
            />
            <span className="text-sm text-slate-700 dark:text-zinc-300">
              Create new subject
            </span>
          </label>
        </fieldset>

        {addMode === "existing" ? (
          <form action={assignAction} className="mt-4 space-y-3">
            {flash(assignState)}
            <div className="block text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-700 dark:text-zinc-300">
                  Subjects{" "}
                  <span className="text-red-600 dark:text-red-400">*</span>
                </span>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {multipleSubjectIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setMultipleSubjectIds([])}
                      className="shrink-0 text-xs font-medium text-school-primary hover:opacity-90 dark:text-school-primary dark:hover:opacity-90"
                    >
                      Clear selection
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={resetAssignFormLayout}
                    className="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <ExistingSubjectsMultiPicker
                key={assignFormResetNonce}
                subjects={rows}
                selectedIds={multipleSubjectIds}
                onSelectedIdsChange={setMultipleSubjectIds}
              />
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Selected: {multipleSubjectIds.length} subject
              {multipleSubjectIds.length === 1 ? "" : "s"}
            </p>

            <div className="block text-sm sm:col-span-2">
              <span className="text-slate-700 dark:text-zinc-300">
                Assign selected subjects to classes:
              </span>
              {classOptions.length === 0 ? (
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                  No classes yet. Add classes first, then map subjects here.
                </p>
              ) : (
                <SubjectClassPicker
                  key={`subject-assign-${assignFormResetNonce}-${[...multipleSubjectIds].sort().join(",") || "none"}`}
                  classOptions={classOptions}
                  defaultSelectedIds={assignClassPickerDefaults}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={
                  assignPending || multipleSubjectIds.length === 0
                }
                className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
              >
                {assignPending ? "Saving…" : "Save assignments"}
              </button>
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Bulk Add Subjects
              </button>
            </div>
          </form>
        ) : (
          <form
            action={createAction}
            className="mt-4 space-y-3"
            onSubmit={(e) => applyAutoSubjectCodeIfEmpty(e.currentTarget)}
          >
            {flash(createState)}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-700 dark:text-zinc-300">Name</span>
                <input
                  name="name"
                  type="text"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  placeholder="Mathematics"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700 dark:text-zinc-300">
                  Code (optional)
                </span>
                <input
                  name="code"
                  type="text"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  placeholder="MATH-101"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-700 dark:text-zinc-300">
                  Description (optional)
                </span>
                <textarea
                  name="description"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  placeholder="Core subject for Forms 1–4"
                />
              </label>
              <div className="block text-sm sm:col-span-2">
                <span className="text-slate-700 dark:text-zinc-300">
                  Assign to classes
                </span>
                {classOptions.length === 0 ? (
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                    No classes yet. Add classes first, then map subjects here.
                  </p>
                ) : (
                  <SubjectClassPicker
                    key="subject-add-classes"
                    classOptions={classOptions}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={createPending}
                className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
              >
                {createPending ? "Saving…" : "Add subject"}
              </button>
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Bulk Add Subjects
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Subjects
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Edit or remove subjects. Deleting is only allowed when no teacher
          assignments use the subject.
        </p>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">
            No subjects yet. Add one above, then assign them on the{" "}
            <Link
              href="/dashboard/teachers"
              className="font-medium text-school-primary hover:underline dark:text-school-primary"
            >
              Teachers
            </Link>{" "}
            page.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subjects by name, code, or description..."
                  aria-label="Search subjects"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/20 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-school-primary dark:focus:ring-school-primary/20"
                />
              </div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                aria-label="Filter by class"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/20 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:focus:border-school-primary dark:focus:ring-school-primary/20 sm:w-56"
              >
                <option value="all">All classes</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatNativeSelectClassOptionLabel(
                      c.name,
                      c.parent_class_id
                    )}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-slate-500 dark:text-zinc-400">
                  Rows
                </span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    const n = Number(e.target.value) as StudentListRowOption;
                    setRowsPerPage(n);
                    setPage(1);
                    localStorage.setItem(
                      DASHBOARD_SUBJECTS_ROWS_STORAGE_KEY,
                      String(n)
                    );
                  }}
                  aria-label="Rows per page"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/20 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:focus:border-school-primary dark:focus:ring-school-primary/20"
                >
                  {STUDENT_LIST_ROW_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!isFiltering}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Clear filters
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
              {totalCount === 0
                ? isFiltering
                  ? "No subjects match the current filters."
                  : "No subjects yet."
                : `Showing ${showingFrom}–${showingTo} of ${totalCount} subject${totalCount === 1 ? "" : "s"}`}
            </p>

            {totalCount === 0 ? null : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-700">
                      <th className="pb-2 pr-4 font-medium text-slate-700 dark:text-zinc-300">
                        Name
                      </th>
                      <th className="pb-2 pr-4 font-medium text-slate-700 dark:text-zinc-300">
                        Code
                      </th>
                      <th className="pb-2 pr-4 font-medium text-slate-700 dark:text-zinc-300">
                        Description
                      </th>
                      <th className="pb-2 pr-4 font-medium text-slate-700 dark:text-zinc-300">
                        Assigned classes
                      </th>
                      <th className="pb-2 pr-4 font-medium text-slate-700 dark:text-zinc-300">
                        Assigned to
                      </th>
                      <th className="pb-2 font-medium text-slate-700 dark:text-zinc-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {pagedRows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                          {r.name}
                        </td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">
                          {r.code ?? "—"}
                        </td>
                        <td className="max-w-xs py-3 pr-4 text-slate-600 dark:text-zinc-400">
                          <span className="line-clamp-2">
                            {r.description?.trim() || "—"}
                          </span>
                        </td>
                        <td className="max-w-[200px] py-3 pr-4 text-slate-600 dark:text-zinc-400">
                          {r.assignedClassNames.trim() ? r.assignedClassNames : "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">
                          {r.assignmentCount}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(r)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(r)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 ? (
              <nav
                className="mt-4 flex flex-wrap items-center justify-center gap-2"
                aria-label="Subjects pagination"
              >
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Previous
                </button>
                {paginationItems.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                      aria-hidden
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      aria-current={item === safePage ? "page" : undefined}
                      className={
                        item === safePage
                          ? "rounded-lg border border-school-primary bg-school-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                          : "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      }
                    >
                      {item}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Next
                </button>
              </nav>
            ) : null}
          </>
        )}
      </section>

      {editing ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-subject-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditModal();
          }}
        >
          <div
            className="animate-subject-modal-in w-full max-w-md overflow-visible rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <EditSubjectModalContent
              key={editing.id}
              editing={editing}
              updateState={updateState}
              updatePending={updatePending}
              updateAction={updateAction}
              classOptions={classOptions}
              onClose={closeEditModal}
            />
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-subject-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3
              id="delete-subject-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Delete subject?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              Remove <strong className="text-slate-900 dark:text-white">{deleting.name}</strong>{" "}
              from your school. This is only possible when no teacher assignments
              reference it.
            </p>
            <form action={deleteAction} className="mt-4 space-y-3">
              {flash(deleteState)}
              <input type="hidden" name="id" value={deleting.id} />
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleting(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deletePending || deleting.assignmentCount > 0}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
                >
                  {deletePending ? "Deleting…" : "Delete"}
                </button>
              </div>
              {deleting.assignmentCount > 0 ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This subject has {deleting.assignmentCount} assignment
                  {deleting.assignmentCount === 1 ? "" : "s"}. Remove them on the
                  Teachers page first.
                </p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}

      {bulkOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-subject-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBulkOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg overflow-visible rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="bulk-subject-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Bulk add subjects
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                  Enter subject names separated by commas or new lines. Names
                  are saved in UPPERCASE.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-primary-rgb)/0.4)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <form action={bulkAction} className="mt-4 space-y-3">
              {flash(bulkState)}
              <label className="block text-sm">
                <span className="text-slate-700 dark:text-zinc-300">
                  Subject names
                </span>
                <textarea
                  name="names_raw"
                  rows={6}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  placeholder={"BIOLOGY, CHEMISTRY, PHYSICS\nor one per line"}
                />
                <span className="mt-1 block text-xs text-slate-500 dark:text-zinc-500">
                  Duplicates and entries that already exist for your school are
                  skipped.
                </span>
              </label>

              <label className="block text-sm">
                <span className="text-slate-700 dark:text-zinc-300">
                  Code prefix (optional)
                </span>
                <input
                  name="code_prefix"
                  type="text"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  placeholder="e.g. SCI → SCI-101, SCI-102…"
                />
                <span className="mt-1 block text-xs text-slate-500 dark:text-zinc-500">
                  If left blank, codes are auto-generated from each subject
                  name.
                </span>
              </label>

              <label className="block text-sm">
                <span className="text-slate-700 dark:text-zinc-300">
                  Description (optional, applied to all)
                </span>
                <textarea
                  name="description"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  placeholder="Optional shared description"
                />
              </label>

              <div className="block text-sm">
                <span className="text-slate-700 dark:text-zinc-300">
                  Assign to classes (applied to all)
                </span>
                {classOptions.length === 0 ? (
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                    No classes yet. Add classes first, then bulk-create
                    subjects here.
                  </p>
                ) : (
                  <SubjectClassPicker
                    key="subject-bulk-classes"
                    classOptions={classOptions}
                  />
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={bulkPending}
                  className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
                >
                  {bulkPending ? "Adding…" : "Add subjects"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
