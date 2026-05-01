"use client";

import { useRouter } from "next/navigation";
import {
  useRef,
  useEffect,
  useMemo,
  useState,
  useTransition,
  useCallback,
  type FormEvent,
} from "react";
import { Pencil } from "lucide-react";
import {
  addStudent,
  getSubjectsForClass,
  peekStudentCreateNameDuplicate,
  type StudentActionState,
} from "./actions";
import { todayIsoLocal } from "@/lib/enrollment-date";
import {
  SUBJECT_ENROLLMENT_TERMS,
  currentAcademicYear,
} from "@/lib/student-subject-enrollment";
import { formatNativeSelectClassOptionLabel } from "@/lib/class-options";
import { enqueueOrRun } from "@/lib/offline/enqueue-or-run";
import { makeTempStudentId } from "@/lib/offline/temp-ids";
import {
  blockInvalidKeyDownAdmission,
  blockInvalidKeyDownLettersName,
  blockInvalidKeyDownPhone,
  HINT_ALPHANUM_HYPHEN,
  HINT_LETTERS_AND_SPACES,
  HINT_ONLY_NUMBERS,
  hasInvalidAdmissionInput,
  hasInvalidLettersNameInput,
  hasInvalidPhoneInput,
  onlyAlphanumericHyphen,
  onlyLettersAndSpaces,
  onlyNumbers,
} from "@/lib/validation";

/** Title-case one segment (handles O'Connor-style apostrophes). */
function capitalizeNameSegment(segment: string): string {
  if (!segment) return segment;
  const lower = segment.toLowerCase();
  if (lower.includes("'")) {
    return lower
      .split("'")
      .map((part) =>
        part ? part.charAt(0).toUpperCase() + part.slice(1) : ""
      )
      .join("'");
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Title-case a single whitespace-delimited word (handles hyphens). */
function capitalizeNameWord(word: string): string {
  if (!word) return word;
  if (word.includes("-")) {
    return word.split("-").map(capitalizeNameSegment).join("-");
  }
  return capitalizeNameSegment(word);
}

/** Full name on blur: trim runs of spaces, title-case each word. Empty / whitespace-only unchanged. */
function toTitleCase(str: string): string {
  if (!str.trim()) return str;
  return str
    .trim()
    .split(/\s+/)
    .map(capitalizeNameWord)
    .join(" ");
}

function toLowercaseEmail(str: string): string {
  if (!str.trim()) return str;
  return str.trim().toLowerCase();
}

function syncAdmissionFromPreview(
  preview: string | null | undefined
): { value: string; snapshot: string } {
  const v = (preview ?? "").trim();
  return { value: v, snapshot: v };
}

function SubmitButton({ disabled, pending }: { disabled?: boolean; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Adding…" : "Add student"}
    </button>
  );
}

interface Props {
  classes: { id: string; name: string; parent_class_id: string | null }[];
  /** Current enrolment count for plan warnings. */
  studentCount?: number;
  /** Plan cap; null = unlimited. */
  studentLimit?: number | null;
  /** Next admission number preview (does not reserve a slot). */
  nextAdmissionPreview?: string | null;
  /** School prefix when set (3–4 letters). */
  schoolAdmissionPrefix?: string | null;
}

const initialState: StudentActionState = {};

export function AddStudentForm({
  classes,
  studentCount = 0,
  studentLimit = null,
  nextAdmissionPreview = null,
  schoolAdmissionPrefix = null,
}: Props) {
  const effectivePrefix =
    typeof schoolAdmissionPrefix === "string"
      ? schoolAdmissionPrefix.trim().toUpperCase()
      : "";
  const hasAdmissionPrefix = effectivePrefix.length > 0;

  const router = useRouter();
  const [state, setState] = useState<
    StudentActionState & { queued?: boolean }
  >(initialState);
  const [submitting, startSubmit] = useTransition();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const admissionInputRef = useRef<HTMLInputElement>(null);
  const namePeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bypassPhoneNextSubmitRef = useRef(false);
  const [nameDuplicateWarning, setNameDuplicateWarning] = useState<string | null>(
    null
  );
  const [phoneDuplicateModalName, setPhoneDuplicateModalName] = useState<
    string | null
  >(null);
  const [admissionValue, setAdmissionValue] = useState("");
  const [admissionSnapshot, setAdmissionSnapshot] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classSubjectOptions, setClassSubjectOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  // Controlled subject selection so the new "Select All" checkbox can drive
  // the per-subject boxes and the per-subject boxes can drive the header
  // checkbox's checked / indeterminate state.
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [fieldHints, setFieldHints] = useState<{
    full_name: string | null;
    admission_number: string | null;
    parent_name: string | null;
    parent_phone: string | null;
  }>({
    full_name: null,
    admission_number: null,
    parent_name: null,
    parent_phone: null,
  });

  type FieldHintKey = keyof typeof fieldHints;
  const fieldHintTimeoutsRef = useRef<
    Partial<Record<FieldHintKey, ReturnType<typeof setTimeout>>>
  >({});

  function clearFieldHintTimeout(key: FieldHintKey) {
    const t = fieldHintTimeoutsRef.current[key];
    if (t != null) {
      clearTimeout(t);
      delete fieldHintTimeoutsRef.current[key];
    }
  }

  function armFieldHintDismiss(key: FieldHintKey) {
    clearFieldHintTimeout(key);
    fieldHintTimeoutsRef.current[key] = setTimeout(() => {
      delete fieldHintTimeoutsRef.current[key];
      setFieldHints((prev) => ({ ...prev, [key]: null }));
    }, 2000);
  }

  function clearAllFieldHintTimeouts() {
    const m = fieldHintTimeoutsRef.current;
    for (const k of Object.keys(m) as FieldHintKey[]) {
      const t = m[k];
      if (t != null) clearTimeout(t);
    }
    fieldHintTimeoutsRef.current = {};
  }

  useEffect(() => () => clearAllFieldHintTimeouts(), []);

  useEffect(() => {
    if (!selectedClassId) {
      setClassSubjectOptions([]);
      setSelectedSubjectIds([]);
      return;
    }
    let cancelled = false;
    setSubjectsLoading(true);
    // Reset selection whenever the class changes — the previous IDs belong to
    // a different class's subject list and we don't want phantom IDs sneaking
    // into the FormData on submit.
    setSelectedSubjectIds([]);
    void getSubjectsForClass(selectedClassId).then((opts) => {
      if (cancelled) return;
      setClassSubjectOptions(opts);
      setSubjectsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId]);

  const allSelected = useMemo(
    () =>
      classSubjectOptions.length > 0 &&
      selectedSubjectIds.length === classSubjectOptions.length,
    [classSubjectOptions, selectedSubjectIds]
  );
  const someSelected =
    selectedSubjectIds.length > 0 && !allSelected;

  // Native `indeterminate` is a DOM-only flag (no React prop), so sync it
  // imperatively whenever the partial-selection state changes.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggleSubject(subjectId: string, checked: boolean) {
    setSelectedSubjectIds((prev) => {
      if (checked) return prev.includes(subjectId) ? prev : [...prev, subjectId];
      return prev.filter((id) => id !== subjectId);
    });
  }

  function toggleAllSubjects(checked: boolean) {
    setSelectedSubjectIds(
      checked ? classSubjectOptions.map((sub) => sub.id) : []
    );
  }

  useEffect(() => {
    if (open && hasAdmissionPrefix) {
      const { value, snapshot } = syncAdmissionFromPreview(
        nextAdmissionPreview
      );
      setAdmissionValue(value);
      setAdmissionSnapshot(snapshot);
    }
  }, [open, hasAdmissionPrefix, nextAdmissionPreview]);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setSelectedClassId("");
      setClassSubjectOptions([]);
      setSelectedSubjectIds([]);
      setOpen(false);
      setNameDuplicateWarning(null);
      setPhoneDuplicateModalName(null);
      clearAllFieldHintTimeouts();
      setFieldHints({
        full_name: null,
        admission_number: null,
        parent_name: null,
        parent_phone: null,
      });
      router.refresh();
    }
  }, [state.success, router]);

  useEffect(() => {
    return () => {
      if (namePeekTimerRef.current) {
        clearTimeout(namePeekTimerRef.current);
      }
    };
  }, []);

  const scheduleNameDuplicatePeek = useCallback(() => {
    if (namePeekTimerRef.current) {
      clearTimeout(namePeekTimerRef.current);
    }
    namePeekTimerRef.current = setTimeout(() => {
      namePeekTimerRef.current = null;
      const el = formRef.current?.querySelector<HTMLInputElement>(
        "#full_name"
      );
      const v = el?.value?.trim() ?? "";
      if (v.length < 2) {
        setNameDuplicateWarning(null);
        return;
      }
      void peekStudentCreateNameDuplicate(v).then(({ matches }) => {
        if (matches.length === 0) {
          setNameDuplicateWarning(null);
          return;
        }
        const first = matches[0];
        if (matches.length === 1) {
          setNameDuplicateWarning(
            `A student named "${first}" is already in this school. You can still add this student if the name is correct.`
          );
        } else {
          setNameDuplicateWarning(
            `A student named "${first}" is already in this school (same name may appear more than once). You can still add this student if the name is correct.`
          );
        }
      });
    }, 400);
  }, []);

  /**
   * Offline-aware submit. The wrinkle: the server action currently
   * decides what fields to use, so we must hand it a real `FormData`.
   * For the offline path we serialize the same FormData into a plain
   * record and tag it with `_tempStudentId` so the dispatcher can map
   * the temp id → real UUID once the create succeeds.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (atStudentLimit) return;

    const form = event.currentTarget;
    if (form == null) return;
    const formData = new FormData(form);

    const fullNameRaw = String(formData.get("full_name") ?? "");
    const fullNameClean = onlyLettersAndSpaces(fullNameRaw).trim();
    if (!fullNameClean) {
      setState({ error: "Please enter the student's full name." });
      return;
    }
    if (fullNameRaw !== onlyLettersAndSpaces(fullNameRaw)) {
      setState({ error: HINT_LETTERS_AND_SPACES });
      return;
    }
    formData.set("full_name", fullNameClean);

    const admissionRaw = String(formData.get("admission_number") ?? "");
    if (
      admissionRaw.trim() !== "" &&
      admissionRaw !== onlyAlphanumericHyphen(admissionRaw)
    ) {
      setState({ error: HINT_ALPHANUM_HYPHEN });
      return;
    }
    formData.set(
      "admission_number",
      onlyAlphanumericHyphen(admissionRaw).trim()
    );

    const parentNameRaw = String(formData.get("parent_name") ?? "");
    if (
      parentNameRaw.trim() !== "" &&
      parentNameRaw !== onlyLettersAndSpaces(parentNameRaw)
    ) {
      setState({ error: HINT_LETTERS_AND_SPACES });
      return;
    }
    formData.set(
      "parent_name",
      onlyLettersAndSpaces(parentNameRaw).trim()
    );

    const parentPhoneRaw = String(formData.get("parent_phone") ?? "");
    if (
      parentPhoneRaw.trim() !== "" &&
      parentPhoneRaw !== onlyNumbers(parentPhoneRaw)
    ) {
      setState({ error: HINT_ONLY_NUMBERS });
      return;
    }
    formData.set("parent_phone", onlyNumbers(parentPhoneRaw));

    if (bypassPhoneNextSubmitRef.current) {
      formData.set("force_duplicate_phone", "1");
      bypassPhoneNextSubmitRef.current = false;
    }
    const tempStudentId = makeTempStudentId();

    // Plain-object copy for replay. `subject_ids` may repeat — collect as
    // string[] under the same key so `buildFormData` (in the dispatcher)
    // re-emits one entry per id.
    const payload: Record<string, string | string[]> = {
      _tempStudentId: tempStudentId,
    };
    formData.forEach((value, key) => {
      if (typeof value !== "string") return;
      const existing = payload[key];
      if (existing == null) {
        payload[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        payload[key] = [existing, value];
      }
    });

    const fullName =
      typeof payload["full_name"] === "string"
        ? (payload["full_name"] as string)
        : "(new student)";
    const parentPhone =
      typeof payload["parent_phone"] === "string"
        ? (payload["parent_phone"] as string)
        : null;
    const classId =
      typeof payload["class_id"] === "string"
        ? (payload["class_id"] as string)
        : null;

    setState({});
    startSubmit(() => {
      void (async () => {
        try {
          const wrapped = await enqueueOrRun({
            kind: "create-student",
            payload,
            run: () => addStudent({}, formData),
            hint: {
              label: `Student · ${fullName}`,
              students: {
                tempStudentId,
                fullName,
                classId,
                parentPhone,
                op: "create",
              },
            },
          });

          if (!wrapped.ok) {
            setState({ error: wrapped.error });
            return;
          }
          if (wrapped.queued) {
            setState({
              success: `Saved offline – "${fullName}" will sync when online.`,
              queued: true,
            });
            // Reset + close the form just like a normal success so the
            // user can keep adding students. The pending row appears in
            // the list below via the live-query merge.
            formRef.current?.reset();
            setSelectedClassId("");
            setClassSubjectOptions([]);
            setSelectedSubjectIds([]);
            setOpen(false);
            clearAllFieldHintTimeouts();
            setFieldHints({
              full_name: null,
              admission_number: null,
              parent_name: null,
              parent_phone: null,
            });
            return;
          }
          const result = wrapped.result;
          if (
            result.phoneDuplicateConflict &&
            result.existingStudentForPhone
          ) {
            setPhoneDuplicateModalName(result.existingStudentForPhone);
            setState({});
            return;
          }
          setPhoneDuplicateModalName(null);
          setState(result);
        } catch (e) {
          setState({
            error: e instanceof Error ? e.message : "Something went wrong.",
          });
        }
      })();
    });
  };

  const atStudentLimit =
    studentLimit != null && studentCount >= studentLimit;
  const approachingLimit =
    studentLimit != null &&
    !atStudentLimit &&
    studentCount >= Math.max(0, studentLimit - 5);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (!next) {
              setNameDuplicateWarning(null);
              setPhoneDuplicateModalName(null);
              clearAllFieldHintTimeouts();
              setFieldHints({
                full_name: null,
                admission_number: null,
                parent_name: null,
                parent_phone: null,
              });
            }
            return next;
          });
        }}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Add a new student
        </h2>
        <svg
          className={`h-5 w-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="border-t border-slate-200 px-6 pb-6 pt-4 dark:border-zinc-800"
        >
          {atStudentLimit ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
              You&apos;ve reached your plan limit ({studentLimit} students).
              Upgrade on the{" "}
              <a
                href="/pricing"
                className="font-medium text-school-primary underline-offset-2 hover:underline dark:text-school-primary"
              >
                Pricing
              </a>{" "}
              page to add more.
            </div>
          ) : approachingLimit ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              You&apos;re close to your plan limit: {studentCount} of{" "}
              {studentLimit} students used.
            </div>
          ) : null}
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
            Student Information
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="full_name"
                className="text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="e.g. Jane Doe"
                onKeyDown={blockInvalidKeyDownLettersName}
                onChange={(e) => {
                  const el = e.currentTarget;
                  if (el == null) return;
                  const raw = el.value;
                  const next = onlyLettersAndSpaces(raw);
                  if (hasInvalidLettersNameInput(raw)) {
                    setFieldHints((h) => ({
                      ...h,
                      full_name: HINT_LETTERS_AND_SPACES,
                    }));
                    armFieldHintDismiss("full_name");
                  } else {
                    clearFieldHintTimeout("full_name");
                    setFieldHints((h) => ({ ...h, full_name: null }));
                  }
                  if (next !== raw) el.value = next;
                  scheduleNameDuplicatePeek();
                }}
                onBlur={(e) => {
                  const el = e.currentTarget;
                  if (el == null) return;
                  el.value = toTitleCase(el.value);
                  const titled = el.value;
                  if (hasInvalidLettersNameInput(titled)) {
                    setFieldHints((h) => ({
                      ...h,
                      full_name: HINT_LETTERS_AND_SPACES,
                    }));
                    armFieldHintDismiss("full_name");
                  } else {
                    clearFieldHintTimeout("full_name");
                    setFieldHints((h) => ({ ...h, full_name: null }));
                  }
                  scheduleNameDuplicatePeek();
                }}
              />
              {fieldHints.full_name ? (
                <p className="text-xs text-red-500" role="alert">
                  {fieldHints.full_name}
                </p>
              ) : null}
              {nameDuplicateWarning ? (
                <p
                  className="text-xs text-amber-800 dark:text-amber-200/90"
                  role="status"
                >
                  {nameDuplicateWarning}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="admission_number"
                className="text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Admission number
              </label>
              {hasAdmissionPrefix ? (
                <div className="flex gap-2">
                  <input
                    type="hidden"
                    name="admission_default_snapshot"
                    value={admissionSnapshot}
                  />
                  <input
                    ref={admissionInputRef}
                    id="admission_number"
                    name="admission_number"
                    type="text"
                    autoComplete="off"
                    value={admissionValue}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (hasInvalidAdmissionInput(raw)) {
                        setFieldHints((h) => ({
                          ...h,
                          admission_number: HINT_ALPHANUM_HYPHEN,
                        }));
                        armFieldHintDismiss("admission_number");
                      } else {
                        clearFieldHintTimeout("admission_number");
                        setFieldHints((h) => ({
                          ...h,
                          admission_number: null,
                        }));
                      }
                      setAdmissionValue(onlyAlphanumericHyphen(raw));
                    }}
                    onKeyDown={blockInvalidKeyDownAdmission}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                    placeholder={`e.g. ${effectivePrefix}-001`}
                  />
                  <button
                    type="button"
                    title="Focus field to edit admission number"
                    onClick={() => {
                      admissionInputRef.current?.focus();
                      admissionInputRef.current?.select();
                    }}
                    className="h-10 shrink-0 rounded-lg border border-gray-200 px-2 text-slate-600 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <input
                  id="admission_number"
                  name="admission_number"
                  type="text"
                  onKeyDown={blockInvalidKeyDownAdmission}
                  onChange={(e) => {
                    const el = e.currentTarget;
                    if (el == null) return;
                    const raw = el.value;
                    const next = onlyAlphanumericHyphen(raw);
                    if (hasInvalidAdmissionInput(raw)) {
                      setFieldHints((h) => ({
                        ...h,
                        admission_number: HINT_ALPHANUM_HYPHEN,
                      }));
                      armFieldHintDismiss("admission_number");
                    } else {
                      clearFieldHintTimeout("admission_number");
                      setFieldHints((h) => ({
                        ...h,
                        admission_number: null,
                      }));
                    }
                    if (next !== raw) el.value = next;
                  }}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                  placeholder="e.g. ADM-001 (optional)"
                />
              )}
              {hasAdmissionPrefix ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                  Auto-generated. You can edit.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  Set a school admission prefix in School settings to enable
                  auto-generated numbers.
                </p>
              )}
              {fieldHints.admission_number ? (
                <p className="mt-0.5 text-xs text-red-500" role="alert">
                  {fieldHints.admission_number}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="class_id"
                className="text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Class <span className="text-red-500">*</span>
              </label>
              <select
                id="class_id"
                name="class_id"
                required
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatNativeSelectClassOptionLabel(
                      c.name,
                      c.parent_class_id
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="gender"
                className="text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                id="gender"
                name="gender"
                required
                defaultValue=""
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="" disabled>
                  Select gender
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            {selectedClassId ? (
              <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  Subjects this student will study
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Optional. Choose the term and year, then tick the subjects this
                  learner takes. You can change these later when editing the
                  student.
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Academic year
                    <input
                      type="number"
                      id="subject_academic_year"
                      name="subject_academic_year"
                      min={2000}
                      max={2100}
                      defaultValue={currentAcademicYear()}
                      className="h-10 w-36 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Term
                    <select
                      id="subject_term"
                      name="subject_term"
                      defaultValue="Term 1"
                      className="h-10 min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    >
                      {SUBJECT_ENROLLMENT_TERMS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {subjectsLoading ? (
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Loading subjects…
                  </p>
                ) : classSubjectOptions.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300/90">
                    No subjects linked to this class yet. Configure subjects under
                    Manage Subjects first.
                  </p>
                ) : (
                  <div className="rounded-lg border border-slate-100 p-3 dark:border-zinc-800">
                    <label
                      htmlFor="add-subj-select-all"
                      className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-zinc-800"
                    >
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        id="add-subj-select-all"
                        checked={allSelected}
                        onChange={(e) => toggleAllSubjects(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-school-primary focus:ring-school-primary dark:border-zinc-600"
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                        Select All subjects
                      </span>
                      <span className="ml-auto text-xs text-slate-500 dark:text-zinc-400">
                        {selectedSubjectIds.length} of{" "}
                        {classSubjectOptions.length} selected
                      </span>
                    </label>
                    <ul className="mt-2 grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                      {classSubjectOptions.map((sub) => (
                        <li key={sub.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`add-subj-${sub.id}`}
                            name="subject_ids"
                            value={sub.id}
                            checked={selectedSubjectIds.includes(sub.id)}
                            onChange={(e) =>
                              toggleSubject(sub.id, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-school-primary focus:ring-school-primary dark:border-zinc-600"
                          />
                          <label
                            htmlFor={`add-subj-${sub.id}`}
                            className="text-sm text-slate-800 dark:text-zinc-200"
                          >
                            {sub.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <label
                htmlFor="enrollment_date"
                className="text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Enrollment date
              </label>
              <input
                id="enrollment_date"
                name="enrollment_date"
                type="date"
                defaultValue={todayIsoLocal()}
                suppressHydrationWarning
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Defaults to today; change for a back-dated enrolment.
              </p>
            </div>
          </div>

          <h3 className="mb-2 mt-4 text-sm font-semibold text-gray-700 dark:text-zinc-300">
            Parent Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="parent_name"
                className="text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Parent name
              </label>
              <input
                id="parent_name"
                name="parent_name"
                type="text"
                onKeyDown={blockInvalidKeyDownLettersName}
                onChange={(e) => {
                  const el = e.currentTarget;
                  if (el == null) return;
                  const raw = el.value;
                  const next = onlyLettersAndSpaces(raw);
                  if (hasInvalidLettersNameInput(raw)) {
                    setFieldHints((h) => ({
                      ...h,
                      parent_name: HINT_LETTERS_AND_SPACES,
                    }));
                    armFieldHintDismiss("parent_name");
                  } else {
                    clearFieldHintTimeout("parent_name");
                    setFieldHints((h) => ({ ...h, parent_name: null }));
                  }
                  if (next !== raw) el.value = next;
                }}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="Parent's full name"
                onBlur={(e) => {
                  const el = e.currentTarget;
                  if (el == null) return;
                  el.value = toTitleCase(el.value);
                  const titled = el.value;
                  if (hasInvalidLettersNameInput(titled)) {
                    setFieldHints((h) => ({
                      ...h,
                      parent_name: HINT_LETTERS_AND_SPACES,
                    }));
                    armFieldHintDismiss("parent_name");
                  } else {
                    clearFieldHintTimeout("parent_name");
                    setFieldHints((h) => ({ ...h, parent_name: null }));
                  }
                }}
              />
              {fieldHints.parent_name ? (
                <p className="text-xs text-red-500" role="alert">
                  {fieldHints.parent_name}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="parent_email"
                className="text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Parent email
              </label>
              <input
                id="parent_email"
                name="parent_email"
                type="email"
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="parent@example.com"
                onBlur={(e) => {
                  const el = e.currentTarget;
                  if (el == null) return;
                  el.value = toLowercaseEmail(el.value);
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="parent_phone"
                className="text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Parent phone
              </label>
              <input
                id="parent_phone"
                name="parent_phone"
                type="text"
                inputMode="numeric"
                autoComplete="tel"
                onKeyDown={blockInvalidKeyDownPhone}
                onChange={(e) => {
                  const el = e.currentTarget;
                  if (el == null) return;
                  const raw = el.value;
                  const next = onlyNumbers(raw);
                  if (hasInvalidPhoneInput(raw)) {
                    setFieldHints((h) => ({
                      ...h,
                      parent_phone: HINT_ONLY_NUMBERS,
                    }));
                    armFieldHintDismiss("parent_phone");
                  } else {
                    clearFieldHintTimeout("parent_phone");
                    setFieldHints((h) => ({ ...h, parent_phone: null }));
                  }
                  if (next !== raw) el.value = next;
                }}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="254700000000"
              />
              {fieldHints.parent_phone ? (
                <p className="text-xs text-red-500" role="alert">
                  {fieldHints.parent_phone}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <SubmitButton disabled={atStudentLimit} pending={submitting} />
          </div>

          {state.error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
              {state.success}
            </p>
          )}
        </form>
      )}

      {phoneDuplicateModalName ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPhoneDuplicateModalName(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="phone-dup-student-title"
          >
            <h3
              id="phone-dup-student-title"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Phone number already in use
            </h3>
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-300">
              This phone number is already used for{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {phoneDuplicateModalName}
              </span>
              . If this is the same parent or guardian, you can proceed.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPhoneDuplicateModalName(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  bypassPhoneNextSubmitRef.current = true;
                  setPhoneDuplicateModalName(null);
                  formRef.current?.requestSubmit();
                }}
                className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
              >
                Proceed anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
