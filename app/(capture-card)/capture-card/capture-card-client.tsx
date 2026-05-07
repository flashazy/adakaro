"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  createCaptureCardStudentAction,
  getCaptureCardSubjectsForClass,
  signOutCaptureCardAction,
  uploadCaptureCardStudentPhotoAction,
} from "@/app/(capture-card)/capture-card-actions";
import {
  StudentPhotoPicker,
  type StudentPhotoDraft,
} from "@/components/students/StudentPhotoPicker";
import { formatEnrollmentDateDisplay } from "@/lib/enrollment-date";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/format-person-name";
import { CaptureButton, CaptureLinkButton } from "@/components/ui/capture-button";
import { EnrollmentDeskHeader } from "@/components/enrollment-desk/EnrollmentDeskHeader";
import {
  SUBJECT_ENROLLMENT_TERMS,
  currentAcademicYear,
  getCurrentAcademicYearAndTerm,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";

const STEPS = [
  "Student",
  "Class",
  "Subjects",
  "Parent",
  "Health",
  "Review",
] as const;

export interface CaptureLatestStudent {
  id: string;
  full_name: string;
  admission_number: string | null;
  enrollment_date: string;
  approval_status: string;
  avatar_url: string | null;
  date_of_birth: string | null;
  class: { name: string } | null;
}

interface CaptureCardClientProps {
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolLogoVersion?: number | null;
  requiresApproval: boolean;
  classes: { id: string; name: string }[];
  latest: CaptureLatestStudent | null;
  myStudents: CaptureLatestStudent[];
  page: number;
  hasMore: boolean;
}

function ApprovalBadge({ status }: { status: string }) {
  const label =
    status === "pending"
      ? "Waiting for approval"
      : status === "approved"
        ? "Approved"
        : "Needs changes";
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
      : status === "pending"
        ? "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
        : "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        cls
      )}
    >
      {label}
    </span>
  );
}

export function CaptureCardClient({
  schoolName,
  schoolLogoUrl = null,
  schoolLogoVersion = null,
  requiresApproval,
  classes,
  latest,
  myStudents,
  page,
  hasMore,
}: CaptureCardClientProps) {
  useEffect(() => {
    console.info("[capture-card] client mounted", {
      schoolNameLen: schoolName.length,
      requiresApproval,
      classesCount: classes.length,
      latestId: latest?.id ?? null,
      studentsCount: myStudents.length,
      page,
      hasMore,
    });
  }, [
    schoolName,
    requiresApproval,
    classes.length,
    latest?.id,
    myStudents.length,
    page,
    hasMore,
  ]);

  const router = useRouter();
  const [logoutState, logoutAction] = useActionState(signOutCaptureCardAction, {});
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [navPending, startNavTransition] = useTransition();
  const [navTarget, setNavTarget] = useState<"prev" | "next" | null>(null);
  const [photoDraft, setPhotoDraft] = useState<StudentPhotoDraft | null>(null);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [classId, setClassId] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [allergies, setAllergies] = useState("");
  const [disability, setDisability] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicy, setInsurancePolicy] = useState("");

  const [subjectAcademicYear, setSubjectAcademicYear] = useState(
    () => getCurrentAcademicYearAndTerm().academicYear
  );
  const [subjectTerm, setSubjectTerm] = useState<SubjectEnrollmentTerm>(
    () => getCurrentAcademicYearAndTerm().term
  );
  const [classSubjectOptions, setClassSubjectOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [assignSubjectsLater, setAssignSubjectsLater] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const academicYearOptions = useMemo(() => {
    const c = currentAcademicYear();
    const out: number[] = [];
    for (let y = c - 2; y <= c + 3; y++) out.push(y);
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return myStudents.filter((s) => {
      const name = s.full_name.toLowerCase();
      const adm = (s.admission_number ?? "").toLowerCase();
      return name.includes(q) || adm.includes(q);
    });
  }, [myStudents, search]);

  function resetWizard() {
    const d = getCurrentAcademicYearAndTerm();
    setStep(1);
    setFullName("");
    setDateOfBirth("");
    setClassId("");
    setGender("");
    setParentName("");
    setParentPhone("");
    setParentEmail("");
    setAllergies("");
    setDisability("");
    setInsuranceProvider("");
    setInsurancePolicy("");
    setPhotoDraft(null);
    setSubjectAcademicYear(d.academicYear);
    setSubjectTerm(d.term);
    setClassSubjectOptions([]);
    setSelectedSubjectIds([]);
    setSubjectsLoading(false);
    setAssignSubjectsLater(false);
  }

  function openWizard() {
    resetWizard();
    setWizardOpen(true);
  }

  const closeWizard = useCallback(() => {
    if (pending) return;
    const dirty =
      fullName.trim() !== "" ||
      dateOfBirth !== "" ||
      classId !== "" ||
      gender !== "" ||
      parentName.trim() !== "" ||
      parentPhone.trim() !== "" ||
      parentEmail.trim() !== "" ||
      allergies.trim() !== "" ||
      disability.trim() !== "" ||
      insuranceProvider.trim() !== "" ||
      insurancePolicy.trim() !== "" ||
      photoDraft != null ||
      selectedSubjectIds.length > 0 ||
      assignSubjectsLater;
    if (
      dirty &&
      !window.confirm("Discard your changes and go back to the home screen?")
    ) {
      return;
    }
    setWizardOpen(false);
    resetWizard();
  }, [
    pending,
    fullName,
    dateOfBirth,
    classId,
    gender,
    parentName,
    parentPhone,
    parentEmail,
    allergies,
    disability,
    insuranceProvider,
    insurancePolicy,
    photoDraft,
    selectedSubjectIds.length,
    assignSubjectsLater,
  ]);

  useEffect(() => {
    if (!classId) {
      setClassSubjectOptions([]);
      setSelectedSubjectIds([]);
      setAssignSubjectsLater(false);
      return;
    }
    setAssignSubjectsLater(false);
    let cancelled = false;
    setSubjectsLoading(true);
    void getCaptureCardSubjectsForClass(classId).then((opts) => {
      if (cancelled) return;
      setClassSubjectOptions(opts);
      setSelectedSubjectIds([]);
      setSubjectsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const allSubjectsSelected = useMemo(
    () =>
      classSubjectOptions.length > 0 &&
      selectedSubjectIds.length === classSubjectOptions.length,
    [classSubjectOptions, selectedSubjectIds]
  );
  const someSubjectsSelected =
    selectedSubjectIds.length > 0 && !allSubjectsSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSubjectsSelected;
    }
  }, [someSubjectsSelected]);

  function toggleSubject(subjectId: string, checked: boolean) {
    if (assignSubjectsLater) return;
    setSelectedSubjectIds((prev) => {
      if (checked) return prev.includes(subjectId) ? prev : [...prev, subjectId];
      return prev.filter((id) => id !== subjectId);
    });
  }

  function toggleAllSubjects(checked: boolean) {
    if (assignSubjectsLater) return;
    setSelectedSubjectIds(
      checked ? classSubjectOptions.map((s) => s.id) : []
    );
  }

  const selectedSubjectLabels = useMemo(() => {
    const m = new Map(classSubjectOptions.map((s) => [s.id, s.name]));
    return selectedSubjectIds.map((id) => m.get(id) ?? "Subject");
  }, [classSubjectOptions, selectedSubjectIds]);

  function submitEnrollment() {
    if (pending) return;
    const nameFormatted = formatPersonName(fullName);
    const parentFormatted = formatPersonName(parentName);
    const allergiesFormatted = allergies.trim() ? allergies.trim().toUpperCase() : "";
    const disabilityFormatted = disability.trim() ? disability.trim().toUpperCase() : "";
    const insuranceFormatted = insuranceProvider.trim()
      ? insuranceProvider.trim().toUpperCase()
      : "";
    setFullName(nameFormatted);
    setParentName(parentFormatted);
    if (allergiesFormatted) setAllergies(allergiesFormatted);
    if (disabilityFormatted) setDisability(disabilityFormatted);
    if (insuranceFormatted) setInsuranceProvider(insuranceFormatted);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("full_name", nameFormatted);
      fd.set("date_of_birth", dateOfBirth);
      fd.set("class_id", classId);
      fd.set("gender", gender);
      fd.set("parent_name", parentFormatted);
      fd.set("parent_phone", parentPhone);
      if (parentEmail.trim()) fd.set("parent_email", parentEmail);
      if (allergiesFormatted) fd.set("allergies", allergiesFormatted);
      if (disabilityFormatted) fd.set("disability", disabilityFormatted);
      if (insuranceFormatted) {
        fd.set("insurance_provider", insuranceFormatted);
      }
      if (insurancePolicy.trim()) fd.set("insurance_policy", insurancePolicy);

      if (!assignSubjectsLater) {
        fd.set("subject_academic_year", String(subjectAcademicYear));
        fd.set("subject_term", subjectTerm);
        for (const sid of selectedSubjectIds) {
          fd.append("subject_ids", sid);
        }
      }

      const res = await createCaptureCardStudentAction(fd);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("ok" in res && res.ok && res.studentId) {
        const sid = res.studentId;
        if (photoDraft?.file) {
          const up = new FormData();
          up.set("avatar", photoDraft.file);
          const photoRes = await uploadCaptureCardStudentPhotoAction(sid, up);
          if (photoRes.error) {
            toast.message("Student captured, but photo upload failed.");
          }
        }
        toast.success(
          requiresApproval
            ? "Student captured and sent for approval."
            : "Student enrolled successfully."
        );
        setWizardOpen(false);
        resetWizard();
        router.refresh();
      }
    });
  }

  function goPage(target: "prev" | "next") {
    if (navPending) return;
    const nextPage = target === "prev" ? Math.max(1, page - 1) : page + 1;
    if (target === "prev" && page <= 1) return;
    if (target === "next" && !hasMore) return;

    setNavTarget(target);
    startNavTransition(() => {
      router.push(nextPage <= 1 ? "/capture-card" : `/capture-card?page=${nextPage}`);
    });
  }

  const stepValid =
    step === 1
      ? Boolean(
          fullName.trim() &&
            dateOfBirth &&
            (gender === "male" || gender === "female")
        )
      : step === 2
        ? Boolean(classId)
        : step === 3
          ? Boolean(
              classId &&
                !subjectsLoading &&
                (assignSubjectsLater || selectedSubjectIds.length > 0)
            )
          : step === 4
            ? Boolean(parentName.trim() && parentPhone.trim())
            : true;

  const canSubmitEnrollment = useMemo(
    () =>
      Boolean(
        fullName.trim() &&
          dateOfBirth &&
          classId &&
          (gender === "male" || gender === "female") &&
          parentName.trim() &&
          parentPhone.trim() &&
          (assignSubjectsLater || selectedSubjectIds.length > 0)
      ),
    [
      fullName,
      dateOfBirth,
      classId,
      gender,
      parentName,
      parentPhone,
      assignSubjectsLater,
      selectedSubjectIds.length,
    ]
  );

  return (
    <div className="min-h-svh bg-slate-50 pb-24 dark:bg-zinc-950">
      <EnrollmentDeskHeader
        schoolName={schoolName}
        schoolLogoUrl={schoolLogoUrl}
        schoolLogoVersion={schoolLogoVersion}
        logoutAction={logoutAction as unknown as (fd: FormData) => void}
        logoutError={logoutState?.error}
      />

      <main className="mx-auto max-w-lg space-y-8 px-4 py-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Latest submitted student
          </h2>
          {!latest ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">
              No submissions yet.
            </p>
          ) : (
            <div className="mt-3 flex gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">
                {latest.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={latest.avatar_url}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-slate-600 dark:text-zinc-300">
                    {latest.full_name
                      .split(/\s+/)
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-white">
                  {latest.full_name}
                </p>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  {latest.admission_number ?? "—"} ·{" "}
                  {latest.class?.name ?? "Class"}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  {formatEnrollmentDateDisplay(latest.enrollment_date)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ApprovalBadge status={latest.approval_status} />
                  <CaptureLinkButton
                    href={`/capture-card/edit/${latest.id}`}
                    variant="primary"
                    size="sm"
                  >
                    Edit
                  </CaptureLinkButton>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Search your students
          </h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or admission number"
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <div className="mt-3 space-y-2">
            {search.trim() === "" ? (
              <p className="text-sm text-slate-500 dark:text-zinc-500">
                Type to find someone you added.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-500">
                No matches.
              </p>
            ) : (
              filtered.slice(0, 12).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-white">
                      {s.full_name}
                    </p>
                    <p className="truncate text-xs text-slate-600 dark:text-zinc-400">
                      {s.admission_number ?? "—"}
                    </p>
                  </div>
                  <CaptureLinkButton
                    href={`/capture-card/edit/${s.id}`}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    Edit
                  </CaptureLinkButton>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <CaptureButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => goPage("prev")}
              disabled={page <= 1 || navPending}
              loading={navPending && navTarget === "prev"}
              loadingLabel="Loading…"
            >
              Previous
            </CaptureButton>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Page {page}
            </p>
            <CaptureButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => goPage("next")}
              disabled={!hasMore || navPending}
              loading={navPending && navTarget === "next"}
              loadingLabel="Loading…"
            >
              Next
            </CaptureButton>
          </div>
        </section>

        <CaptureButton
          type="button"
          onClick={() => {
            if (pending) return;
            openWizard();
          }}
          className="fixed bottom-6 left-1/2 z-20 h-14 w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-2xl text-base font-semibold shadow-lg"
        >
          Enroll New Student
        </CaptureButton>
      </main>

      {wizardOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
            <CaptureButton
              type="button"
              onClick={closeWizard}
              variant="ghost"
              size="sm"
              className="h-9 px-2"
            >
              Close
            </CaptureButton>
            <div className="flex flex-col items-center">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Step {step} of {STEPS.length}
              </p>
              <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                {STEPS[step - 1]}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-500">
                {Math.round((step / STEPS.length) * 100)}% complete
              </p>
            </div>
            <span className="w-10" />
          </div>
          <div className="flex justify-center gap-1.5 px-4 py-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i + 1 <= step ? "bg-school-primary" : "bg-slate-200 dark:bg-zinc-800"
                )}
              />
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            {step === 1 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Student details
                </h3>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Full name
                  </span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => {
                      setFullName((n) => formatPersonName(n));
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Date of birth
                  </span>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <fieldset>
                  <legend className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Gender
                  </legend>
                  <div className="mt-2 flex gap-3">
                    <label className="flex items-center gap-2 text-base">
                      <input
                        type="radio"
                        name="gender"
                        checked={gender === "male"}
                        onChange={() => setGender("male")}
                      />
                      Male
                    </label>
                    <label className="flex items-center gap-2 text-base">
                      <input
                        type="radio"
                        name="gender"
                        checked={gender === "female"}
                        onChange={() => setGender("female")}
                      />
                      Female
                    </label>
                  </div>
                </fieldset>
                <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                    Student photo
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">
                    Optional. You can add a photo now or skip.
                  </p>
                  <StudentPhotoPicker
                    studentName={fullName || "Student"}
                    draft={photoDraft}
                    onDraftChange={setPhotoDraft}
                    disabled={pending}
                    allowRemove={false}
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Select class
                </h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  Choose the class before assigning subjects.
                </p>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Class
                  </span>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="">Choose a class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Subjects Selection
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">
                    Choose the subjects this student will study in the selected
                    class.
                  </p>
                </div>
                {!classId ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                    Please choose a class first.
                  </p>
                ) : null}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 touch-manipulation dark:border-zinc-700 dark:bg-zinc-800/50">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-school-primary focus:ring-school-primary dark:border-zinc-600"
                    checked={assignSubjectsLater}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setAssignSubjectsLater(on);
                      if (on) setSelectedSubjectIds([]);
                    }}
                  />
                  <span className="text-sm text-slate-800 dark:text-zinc-200">
                    This student&apos;s subjects will be assigned later
                  </span>
                </label>
                <div
                  className={cn(
                    "flex flex-col gap-3 sm:flex-row sm:flex-wrap",
                    (!classId || assignSubjectsLater) &&
                      "pointer-events-none opacity-50"
                  )}
                >
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Academic year
                    <select
                      value={subjectAcademicYear}
                      onChange={(e) =>
                        setSubjectAcademicYear(Number(e.target.value))
                      }
                      disabled={!classId || assignSubjectsLater}
                      className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    >
                      {academicYearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Term
                    <select
                      value={subjectTerm}
                      onChange={(e) =>
                        setSubjectTerm(e.target.value as SubjectEnrollmentTerm)
                      }
                      disabled={!classId || assignSubjectsLater}
                      className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
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
                ) : classId && classSubjectOptions.length === 0 ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200/90">
                    No subjects linked to this class yet. An admin can set them
                    under Manage Subjects. You can mark &quot;assigned
                    later&quot; above to continue.
                  </p>
                ) : (
                  <div
                    className={cn(
                      "rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/40",
                      assignSubjectsLater && "pointer-events-none opacity-50"
                    )}
                  >
                    <label
                      htmlFor="capture-subj-select-all"
                      className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-slate-200/80 pb-3 touch-manipulation dark:border-zinc-700"
                    >
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        id="capture-subj-select-all"
                        checked={allSubjectsSelected}
                        onChange={(e) => toggleAllSubjects(e.target.checked)}
                        disabled={!classId || assignSubjectsLater}
                        className="h-5 w-5 shrink-0 rounded border-gray-300 text-school-primary focus:ring-school-primary disabled:opacity-60 dark:border-zinc-600"
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                        Select all subjects
                      </span>
                      <span className="ml-auto text-xs text-slate-500 dark:text-zinc-400">
                        {selectedSubjectIds.length} of{" "}
                        {classSubjectOptions.length} selected
                      </span>
                    </label>
                    <ul className="mt-3 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 sm:gap-3">
                      {classSubjectOptions.map((sub) => (
                        <li
                          key={sub.id}
                          className="flex min-h-11 items-center gap-3 rounded-lg px-1 py-0.5"
                        >
                          <input
                            type="checkbox"
                            id={`capture-subj-${sub.id}`}
                            checked={selectedSubjectIds.includes(sub.id)}
                            onChange={(e) =>
                              toggleSubject(sub.id, e.target.checked)
                            }
                            disabled={!classId || assignSubjectsLater}
                            className="h-5 w-5 shrink-0 rounded border-gray-300 text-school-primary focus:ring-school-primary disabled:opacity-60 dark:border-zinc-600"
                          />
                          <label
                            htmlFor={`capture-subj-${sub.id}`}
                            className="flex-1 cursor-pointer text-sm text-slate-800 dark:text-zinc-200"
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

            {step === 4 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Parent or guardian
                </h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  Contact details for the student&apos;s family.
                </p>
                <label className="block">
                  <span className="text-sm font-medium">Name</span>
                  <input
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    onBlur={() => {
                      setParentName((n) => formatPersonName(n));
                    }}
                    className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Phone</span>
                  <input
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    inputMode="tel"
                    className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Email (optional)</span>
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Health information
                </h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  All optional. Leave blank if not known.
                </p>
                <label className="block">
                  <span className="text-sm font-medium">Allergies</span>
                  <textarea
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    onBlur={() =>
                      setAllergies((v) => (v.trim() ? v.trim().toUpperCase() : v))
                    }
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Disability or support needs</span>
                  <textarea
                    value={disability}
                    onChange={(e) => setDisability(e.target.value)}
                    onBlur={() =>
                      setDisability((v) => (v.trim() ? v.trim().toUpperCase() : v))
                    }
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Health insurance (provider)</span>
                  <input
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    onBlur={() => {
                      setInsuranceProvider((p) =>
                        p.trim() ? p.trim().toUpperCase() : p
                      );
                    }}
                    className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Insurance policy number</span>
                  <input
                    value={insurancePolicy}
                    onChange={(e) => setInsurancePolicy(e.target.value)}
                    className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
              </div>
            ) : null}

            {step === 6 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Review &amp; submit
                </h3>
                <div className="space-y-2 text-sm text-slate-700 dark:text-zinc-300">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Student details
                  </p>
                  <ul className="space-y-2">
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Name:{" "}
                      </span>
                      {fullName}
                    </li>
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Date of birth:{" "}
                      </span>
                      {dateOfBirth}
                    </li>
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Gender:{" "}
                      </span>
                      {gender === "male"
                        ? "Male"
                        : gender === "female"
                          ? "Female"
                          : "—"}
                    </li>
                  </ul>
                </div>
                {photoDraft?.previewUrl ? (
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Photo
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoDraft.previewUrl}
                      alt=""
                      className="mt-2 h-32 w-32 rounded-xl object-cover"
                    />
                  </div>
                ) : null}
                <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Class
                  </p>
                  <p className="text-sm text-slate-700 dark:text-zinc-300">
                    {classes.find((c) => c.id === classId)?.name ?? "—"}
                  </p>
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Academic year &amp; term
                  </p>
                  <ul className="space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Academic year:{" "}
                      </span>
                      {subjectAcademicYear}
                    </li>
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Term:{" "}
                      </span>
                      {subjectTerm}
                    </li>
                  </ul>
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Subjects
                  </p>
                  {assignSubjectsLater || selectedSubjectLabels.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-zinc-400">
                      Subjects will be assigned later.
                    </p>
                  ) : (
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-700 dark:text-zinc-300">
                      {selectedSubjectLabels.map((name, idx) => (
                        <li key={`${name}-${idx}`}>{name}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Parent / guardian
                  </p>
                  <ul className="space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Name:{" "}
                      </span>
                      {parentName || "—"}
                    </li>
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Phone:{" "}
                      </span>
                      {parentPhone}
                    </li>
                    {parentEmail.trim() ? (
                      <li>
                        <span className="font-medium text-slate-900 dark:text-white">
                          Email:{" "}
                        </span>
                        {parentEmail}
                      </li>
                    ) : null}
                  </ul>
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Health information
                  </p>
                  <ul className="space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Allergies:{" "}
                      </span>
                      {allergies.trim() || "—"}
                    </li>
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Disability / support:{" "}
                      </span>
                      {disability.trim() || "—"}
                    </li>
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Insurance provider:{" "}
                      </span>
                      {insuranceProvider.trim() || "—"}
                    </li>
                    <li>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Policy number:{" "}
                      </span>
                      {insurancePolicy.trim() || "—"}
                    </li>
                  </ul>
                </div>
                {requiresApproval ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                    This student will be sent to the admin for approval before
                    they appear on the main school list.
                  </p>
                ) : (
                  <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
                    This student will be added to the school right away.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 p-4 dark:border-zinc-800">
            <div className="mx-auto flex max-w-lg gap-3">
              {step > 1 ? (
                <CaptureButton
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    if (pending) return;
                    setStep((s) => Math.max(1, s - 1));
                  }}
                  className="flex-1 rounded-xl py-3 text-base"
                >
                  Back
                </CaptureButton>
              ) : null}
              {step < STEPS.length ? (
                <CaptureButton
                  type="button"
                  disabled={!stepValid || pending}
                  onClick={() => {
                    if (!stepValid || pending) return;
                    if (step === 1) {
                      setFullName((n) => formatPersonName(n));
                    }
                    if (step === 4) {
                      setParentName((n) => formatPersonName(n));
                    }
                    setStep((s) => s + 1);
                  }}
                  className="flex-1 rounded-xl py-3 text-base font-semibold"
                >
                  Continue
                </CaptureButton>
              ) : (
                <CaptureButton
                  type="button"
                  disabled={pending || !canSubmitEnrollment}
                  onClick={submitEnrollment}
                  loading={pending}
                  loadingLabel="Saving…"
                  className="flex-1 rounded-xl py-3 text-base font-semibold"
                >
                  Submit
                </CaptureButton>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
