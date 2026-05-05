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
  HINT_PARENT_PHONE,
  hasInvalidAdmissionInput,
  hasInvalidLettersNameInput,
  hasInvalidPhoneInput,
  normalizePhoneDigits,
  onlyAlphanumericHyphen,
  onlyLettersAndSpaces,
  sanitizePhoneInput,
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

const labelClass =
  "mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300";
const hintClass = "text-xs text-slate-500 dark:text-zinc-400";
const inputClass =
  "w-full min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-zinc-500";
const dateInputClass = `${inputClass} [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60`;
const sectionCard =
  "space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const sectionTitle = "text-base font-semibold text-slate-900 dark:text-white";
const sectionDesc = "text-sm text-slate-500 dark:text-zinc-400";
const gridForm =
  "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3";
const subjectFieldLabel =
  "block text-sm font-medium text-slate-700 dark:text-zinc-300";

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
  const [healthOpen, setHealthOpen] = useState(false);
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
      setHealthOpen(false);
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

    const dobRaw = String(formData.get("date_of_birth") ?? "").trim();
    if (!dobRaw) {
      setHealthOpen(true);
      setState({ error: "Please enter the student's date of birth." });
      return;
    }

    const parentPhoneRaw = String(formData.get("parent_phone") ?? "");
    if (hasInvalidPhoneInput(parentPhoneRaw)) {
      setState({ error: HINT_PARENT_PHONE });
      return;
    }
    const parentPhoneClean = normalizePhoneDigits(parentPhoneRaw);
    if (!parentPhoneClean) {
      setState({
        error: "Please enter a parent phone number.",
      });
      return;
    }
    formData.set("parent_phone", parentPhoneClean);

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
            setHealthOpen(false);
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
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col border-t border-slate-200 dark:border-zinc-800"
        >
          <div className="space-y-6 px-6 py-6">
          {atStudentLimit ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
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
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              You&apos;re close to your plan limit: {studentCount} of{" "}
              {studentLimit} students used.
            </div>
          ) : null}

          <section className={sectionCard} aria-labelledby="add-student-info-heading">
            <div className="space-y-1">
              <h3 id="add-student-info-heading" className={sectionTitle}>
                Student Information
              </h3>
              <p className={sectionDesc}>
                Basic student details required for enrollment
              </p>
            </div>
            <div className={gridForm}>
            <div className="flex flex-col">
              <label htmlFor="full_name" className={labelClass}>
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                className={inputClass}
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

            <div className="flex flex-col">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <label
                  htmlFor="admission_number"
                  className="text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Admission number
                </label>
                {hasAdmissionPrefix ? (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-slate-200/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-zinc-700 dark:text-zinc-300">
                    Auto-generated
                  </span>
                ) : null}
              </div>
              {hasAdmissionPrefix ? (
                <div className="flex gap-2 rounded-lg border border-slate-200/80 bg-slate-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
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
                    className={`${inputClass} border-slate-200/80 bg-white dark:border-zinc-600 dark:bg-zinc-900`}
                    placeholder={`e.g. ${effectivePrefix}-001`}
                  />
                  <button
                    type="button"
                    title="Edit admission number"
                    onClick={() => {
                      admissionInputRef.current?.focus();
                      admissionInputRef.current?.select();
                    }}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition-colors duration-200 hover:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-800/40">
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
                    className={`${inputClass} border-slate-200/80 bg-white dark:border-zinc-600 dark:bg-zinc-900`}
                    placeholder="e.g. ADM-001 (optional)"
                  />
                </div>
              )}
              {hasAdmissionPrefix ? (
                <p className={`${hintClass} mt-1`}>
                  Suggested from your school prefix — you can change it before
                  saving.
                </p>
              ) : (
                <p className={`${hintClass} mt-1`}>
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

            <div className="flex flex-col">
              <label htmlFor="class_id" className={labelClass}>
                Class <span className="text-red-500">*</span>
              </label>
              <select
                id="class_id"
                name="class_id"
                required
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className={inputClass}
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

            <div className="flex flex-col">
              <label htmlFor="gender" className={labelClass}>
                Gender <span className="text-red-500">*</span>
              </label>
              <select
                id="gender"
                name="gender"
                required
                defaultValue=""
                className={inputClass}
              >
                <option value="" disabled>
                  Select gender
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="flex flex-col md:col-span-2 lg:col-span-1">
              <label htmlFor="enrollment_date" className={labelClass}>
                Enrollment date
              </label>
              <input
                id="enrollment_date"
                name="enrollment_date"
                type="date"
                defaultValue={todayIsoLocal()}
                suppressHydrationWarning
                className={dateInputClass}
              />
              <p className={`${hintClass} mt-1`}>
                Defaults to today; change for a back-dated enrolment.
              </p>
            </div>
            </div>

            {selectedClassId ? (
              <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-zinc-800">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  Subjects this student will study
                </h4>
                <p className={hintClass}>
                  Optional. Choose the term and year, then tick the subjects this
                  learner takes. You can change these later when editing the
                  student.
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className={`flex flex-col gap-1 ${subjectFieldLabel}`}>
                    Academic year
                    <input
                      type="number"
                      id="subject_academic_year"
                      name="subject_academic_year"
                      min={2000}
                      max={2100}
                      defaultValue={currentAcademicYear()}
                      className={`${inputClass} w-36`}
                    />
                  </label>
                  <label className={`flex flex-col gap-1 ${subjectFieldLabel}`}>
                    Term
                    <select
                      id="subject_term"
                      name="subject_term"
                      defaultValue="Term 1"
                      className={`${inputClass} min-w-[10rem]`}
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
                  <div className="rounded-xl bg-slate-50/60 p-4 dark:bg-zinc-800/40">
                    <label
                      htmlFor="add-subj-select-all"
                      className="flex items-center gap-2 border-b border-slate-200/80 pb-3 dark:border-zinc-700"
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
          </section>

          <section
            className={`${sectionCard} overflow-hidden !p-0`}
            aria-labelledby="add-student-health-heading"
          >
            <div className="overflow-hidden rounded-2xl bg-slate-50/60 dark:bg-zinc-800/25">
              <button
                type="button"
                aria-expanded={healthOpen}
                aria-controls="add-student-health-panel"
                onClick={() => setHealthOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition-colors duration-200 hover:bg-slate-100/70 dark:hover:bg-zinc-800/50"
              >
                <div>
                  <h3
                    id="add-student-health-heading"
                    className={sectionTitle}
                  >
                    Health Information (Optional)
                  </h3>
                  <p className={`${sectionDesc} mt-0.5`}>
                    Expand to enter date of birth (required for new students)
                    and optional medical details.
                  </p>
                </div>
                <svg
                  className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${healthOpen ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>
              <div
                id="add-student-health-panel"
                className={`space-y-5 border-t border-slate-200 bg-white px-6 pb-6 pt-5 dark:border-zinc-700 dark:bg-zinc-900 ${healthOpen ? "" : "hidden"}`}
              >
                  <div className="flex flex-col">
                    <label htmlFor="date_of_birth" className={labelClass}>
                      Date of birth <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      required
                      className={dateInputClass}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col">
                      <label htmlFor="allergies" className={labelClass}>
                        Allergies
                      </label>
                      <textarea
                        id="allergies"
                        name="allergies"
                        rows={3}
                        placeholder="e.g., Peanuts, pollen, penicillin"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="disability" className={labelClass}>
                        Disability
                      </label>
                      <textarea
                        id="disability"
                        name="disability"
                        rows={3}
                        placeholder="e.g., Uses wheelchair, dyslexia"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col">
                      <label htmlFor="insurance_provider" className={labelClass}>
                        Health Insurance Provider
                      </label>
                      <input
                        id="insurance_provider"
                        name="insurance_provider"
                        type="text"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="insurance_policy" className={labelClass}>
                        Insurance Policy Number
                      </label>
                      <input
                        id="insurance_policy"
                        name="insurance_policy"
                        type="text"
                        className={inputClass}
                      />
                    </div>
                  </div>
              </div>
            </div>
          </section>

          <section
            className={sectionCard}
            aria-labelledby="add-student-parent-heading"
          >
            <div className="space-y-1">
              <h3 id="add-student-parent-heading" className={sectionTitle}>
                Parent Information
              </h3>
              <p className={sectionDesc}>
                Contact details for the parent or guardian
              </p>
            </div>
            <div className={`${gridForm} !space-y-0`}>
              <div className="flex flex-col">
                <label htmlFor="parent_name" className={labelClass}>
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
                  className={inputClass}
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

              <div className="flex flex-col">
                <label htmlFor="parent_email" className={labelClass}>
                  Parent email
                </label>
                <input
                  id="parent_email"
                  name="parent_email"
                  type="email"
                  className={inputClass}
                  placeholder="parent@example.com"
                  onBlur={(e) => {
                    const el = e.currentTarget;
                    if (el == null) return;
                    el.value = toLowercaseEmail(el.value);
                  }}
                />
              </div>

              <div className="flex flex-col md:col-span-2 lg:col-span-3">
                <label htmlFor="parent_phone" className={labelClass}>
                  Parent phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="parent_phone"
                  name="parent_phone"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="tel"
                  onKeyDown={blockInvalidKeyDownPhone}
                  onChange={(e) => {
                    const el = e.currentTarget;
                    if (el == null) return;
                    const raw = el.value;
                    const next = sanitizePhoneInput(raw);
                    if (hasInvalidPhoneInput(raw)) {
                      setFieldHints((h) => ({
                        ...h,
                        parent_phone: HINT_PARENT_PHONE,
                      }));
                      armFieldHintDismiss("parent_phone");
                    } else {
                      clearFieldHintTimeout("parent_phone");
                      setFieldHints((h) => ({ ...h, parent_phone: null }));
                    }
                    if (next !== raw) el.value = next;
                  }}
                  className={inputClass}
                  placeholder="25570000000 or +255 700 000 000"
                />
                {fieldHints.parent_phone ? (
                  <p className="text-xs text-red-500" role="alert">
                    {fieldHints.parent_phone}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {state.error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
              {state.success}
            </p>
          )}
          </div>

          <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/95 dark:supports-[backdrop-filter]:bg-zinc-900/90 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Make sure required fields are filled before saving.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setNameDuplicateWarning(null);
                  setPhoneDuplicateModalName(null);
                  clearAllFieldHintTimeouts();
                  setFieldHints({
                    full_name: null,
                    admission_number: null,
                    parent_name: null,
                    parent_phone: null,
                  });
                  setOpen(false);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={atStudentLimit || submitting}
                className="rounded-lg bg-school-primary px-6 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
              >
                {submitting ? "Adding…" : "Add student"}
              </button>
            </div>
          </div>
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
