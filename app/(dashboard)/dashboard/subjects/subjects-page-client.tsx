"use client";

import {
  useActionState,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  createSubjectAction,
  deleteSubjectAction,
  updateSubjectAction,
  type SubjectActionState,
  type SubjectRow,
} from "./actions";

/** Auto code from subject name: first word, ≤3 letters → full word; else first 3 letters + "-101". */
export function generateSubjectCode(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "SUB-101";

  const firstWord = trimmed.split(/\s+/)[0] ?? "";
  const letters = firstWord.replace(/[^a-zA-Z]/g, "");
  if (!letters) return "SUB-101";

  const upper = letters.toUpperCase();
  const prefix = upper.length <= 3 ? upper : upper.slice(0, 3);
  return `${prefix}-101`;
}

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
  classOptions: { id: string; name: string }[];
}

function SubjectClassPicker({
  classOptions,
  defaultSelectedIds,
}: {
  classOptions: { id: string; name: string }[];
  defaultSelectedIds?: string[];
}) {
  const listboxId = useId();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => [
    ...(defaultSelectedIds ?? []),
  ]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const pillItems = useMemo(() => {
    return selectedIds
      .map((id) => classOptions.find((c) => c.id === id))
      .filter((c): c is { id: string; name: string } => c != null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedIds, classOptions]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classOptions
      .filter((c) => !selectedSet.has(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
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
    <div className="mt-2 space-y-3">
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
                <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-sm font-medium text-slate-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
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

      <div ref={containerRef} className="relative">
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
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
        />
        {open && canAddMore ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
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
                  className="w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
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

  const [createState, createAction, createPending] = useActionState(
    createSubjectAction,
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

  useLayoutEffect(() => {
    if (deleteState?.ok) {
      setDeleting(null);
    }
  }, [deleteState]);

  useEffect(() => {
    if (createState?.ok || updateState?.ok || deleteState?.ok) {
      router.refresh();
    }
  }, [createState, updateState, deleteState, router]);

  const rows = initialRows;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Back to dashboard
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Add subject
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Create subjects your school uses for teacher assignments (e.g.
          Mathematics, English).
        </p>
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
          <button
            type="submit"
            disabled={createPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {createPending ? "Saving…" : "Add subject"}
          </button>
        </form>
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
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Teachers
            </Link>{" "}
            page.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
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
                {rows.map((r) => (
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
      </section>

      {editing ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-subject-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3
              id="edit-subject-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Edit subject
            </h3>
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
                  defaultValue={editing.name}
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
                  defaultValue={editing.code ?? ""}
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
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {updatePending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
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
    </div>
  );
}
