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
import { CheckCircle2 } from "lucide-react";
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
import { RejectionGuidanceDisplay } from "@/components/enrollment-desk/RejectionGuidanceDisplay";
import {
  getRejectionQueuePreviewDisplay,
  rejectionGuidancePlainSummary,
} from "@/lib/rejection-guidance";
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

type EnrollmentDeskDraftV1 = {
  version: 1;
  savedAt: number;
  step: number;
  fullName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "";
  classId: string;
  subjectAcademicYear: number;
  subjectTerm: SubjectEnrollmentTerm;
  selectedSubjectIds: string[];
  assignSubjectsLater: boolean;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  allergies: string;
  disability: string;
  insuranceProvider: string;
  insurancePolicy: string;
};

function draftStorageKey(schoolName: string): string {
  // We don't have schoolId / captureUserId here. Use a stable per-school key.
  // (If those become available later, this can be expanded safely.)
  return `enrollment-desk-draft:${encodeURIComponent(schoolName)}`;
}

function isMeaningfulDraft(d: EnrollmentDeskDraftV1): boolean {
  return Boolean(
    d.fullName.trim() ||
      d.dateOfBirth ||
      d.classId ||
      d.parentName.trim() ||
      d.parentPhone.trim() ||
      d.selectedSubjectIds.length > 0 ||
      d.assignSubjectsLater ||
      d.allergies.trim() ||
      d.disability.trim() ||
      d.insuranceProvider.trim() ||
      d.insurancePolicy.trim()
  );
}

export interface CaptureCorrectionQueueStudent {
  id: string;
  full_name: string;
  admission_number: string | null;
  enrollment_date: string;
  rejection_reason: string | null;
  avatar_url: string | null;
  created_at: string;
  rejected_at: string | null;
  class: { name: string } | null;
}

export interface CaptureLatestStudent {
  id: string;
  full_name: string;
  admission_number: string | null;
  enrollment_date: string;
  approval_status: string;
  rejection_reason: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  class: { name: string } | null;
}

export interface EnrollmentDeskCaptureUserStats {
  submittedToday: number;
  pending: number;
  approved: number;
  rejected: number;
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
  enrollmentStats?: EnrollmentDeskCaptureUserStats;
  correctionsQueue?: CaptureCorrectionQueueStudent[];
}

const DEFAULT_ENROLLMENT_STATS: EnrollmentDeskCaptureUserStats = {
  submittedToday: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

function EnrollmentDeskStatsBanner({ stats }: { stats: EnrollmentDeskCaptureUserStats }) {
  const chips: {
    label: string;
    value: number;
    dotClass: string;
    cardClass: string;
  }[] = [
    {
      label: "Today",
      value: stats.submittedToday,
      dotClass: "bg-indigo-500",
      cardClass:
        "bg-indigo-50/90 dark:bg-indigo-950/35 border-indigo-100 dark:border-indigo-900/50",
    },
    {
      label: "Pending",
      value: stats.pending,
      dotClass: "bg-amber-500",
      cardClass:
        "bg-amber-50/90 dark:bg-amber-950/35 border-amber-100 dark:border-amber-900/50",
    },
    {
      label: "Approved",
      value: stats.approved,
      dotClass: "bg-emerald-500",
      cardClass:
        "bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-100 dark:border-emerald-900/50",
    },
    {
      label: "Rejected",
      value: stats.rejected,
      dotClass: "bg-red-500",
      cardClass:
        "bg-red-50/90 dark:bg-red-950/35 border-red-100 dark:border-red-900/50",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {chips.map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-xl border p-3 dark:border-transparent",
              c.cardClass
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn("inline-block h-2 w-2 shrink-0 rounded-full", c.dotClass)}
                aria-hidden
              />
              <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                {c.label}
              </p>
            </div>
            <p className="mt-2 tabular-nums text-2xl font-semibold text-slate-900 dark:text-white">
              {c.value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500 dark:text-zinc-500">
        Your enrollment activity for this school.
      </p>
    </section>
  );
}

function studentInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const CORRECTIONS_SCROLL_HINT_MIN = 5;

function CorrectionsNeededQueueSection({
  correctionsQueue,
}: {
  correctionsQueue: CaptureCorrectionQueueStudent[];
}) {
  const total = correctionsQueue.length;

  if (total === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Corrections needed
            </h2>
            <span
              className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-100 px-2 text-xs font-semibold tabular-nums text-red-900 dark:bg-red-950/50 dark:text-red-100"
              aria-label={`${total} rejected ${total === 1 ? "submission" : "submissions"} need corrections`}
            >
              {total}
            </span>
            {total > CORRECTIONS_SCROLL_HINT_MIN ? (
              <span className="text-xs text-slate-500 dark:text-zinc-500">
                Scroll to view more
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Fix rejected submissions and send them back for approval.
          </p>
        </div>
      </div>

      <div
        className="mt-4 max-h-[360px] overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border border-slate-100 py-1 pl-1 pr-2 dark:border-zinc-800 md:max-h-[420px] [scrollbar-gutter:stable]"
        aria-label="Scrollable list of rejected students"
      >
        <ul
          className="space-y-3"
          aria-label="Rejected students to correct"
        >
          {correctionsQueue.map((s) => {
            const preview = getRejectionQueuePreviewDisplay(s.rejection_reason, 2);
            return (
              <li
                key={s.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                    {s.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.avatar_url}
                        alt=""
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                        {studentInitials(s.full_name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium leading-snug text-slate-900 dark:text-white">
                      {s.full_name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-zinc-400">
                      {s.admission_number ?? "—"} · {s.class?.name ?? "Class"}{" "}
                      · {formatEnrollmentDateDisplay(s.enrollment_date)}
                      {s.rejected_at ? (
                        <>
                          {" "}
                          · Rejected{" "}
                          {formatEnrollmentDateDisplay(s.rejected_at)}
                        </>
                      ) : null}
                    </p>
                    <div className="rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 dark:border-red-900/40 dark:bg-red-950/25">
                      <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-red-900 dark:text-red-100/95">
                        {preview.lines.map((line, i) => (
                          <li key={`${s.id}-p-${i}`}>{line}</li>
                        ))}
                      </ul>
                      {preview.suffix ? (
                        <p className="mt-1.5 text-xs font-medium text-red-800/90 dark:text-red-200/90">
                          {preview.suffix}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ApprovalBadge status="rejected" />
                    </div>
                  </div>
                </div>
                <CaptureLinkButton
                  href={`/capture-card/edit/${s.id}`}
                  variant="primary"
                  size="sm"
                  className="h-11 w-full shrink-0 justify-center rounded-xl font-semibold sm:h-10 sm:w-auto sm:min-w-[7.5rem] sm:self-center"
                >
                  Correct
                </CaptureLinkButton>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const label =
    status === "pending"
      ? "Waiting for approval"
      : status === "approved"
        ? "Approved"
        : status === "rejected"
          ? "Rejected"
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
  enrollmentStats,
  correctionsQueue = [],
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
  const [wizardView, setWizardView] = useState<"form" | "success">("form");
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [navPending, startNavTransition] = useTransition();
  const [navTarget, setNavTarget] = useState<"prev" | "next" | null>(null);
  const [photoDraft, setPhotoDraft] = useState<StudentPhotoDraft | null>(null);
  const [keptContextHint, setKeptContextHint] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState<{
    fullName: string;
    className: string;
    requiresApproval: boolean;
  } | null>(null);

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
  const restoringDraftRef = useRef(false);
  const restoredSubjectIdsRef = useRef<string[] | null>(null);
  const [recoveryDraft, setRecoveryDraft] = useState<EnrollmentDeskDraftV1 | null>(
    null
  );
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

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
    setWizardView("form");
    setKeptContextHint(false);
    setLastSubmitted(null);
    setDraftSavedAt(null);
  }

  function resetWizardForNextStudent() {
    setStep(1);
    setWizardView("form");
    setKeptContextHint(true);
    setDraftSavedAt(null);

    // Student-specific fields
    setFullName("");
    setDateOfBirth("");
    setGender("");
    setPhotoDraft(null);
    setParentName("");
    setParentPhone("");
    setParentEmail("");
    setAllergies("");
    setDisability("");
    setInsuranceProvider("");
    setInsurancePolicy("");
  }

  function openWizard() {
    resetWizard();
    setWizardOpen(true);
  }

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftStorageKey(schoolName));
    } catch {
      // ignore
    }
    setDraftSavedAt(null);
    setRecoveryDraft(null);
    setShowRecoveryPrompt(false);
  }, [schoolName]);

  const saveDraft = useCallback(
    (draft: EnrollmentDeskDraftV1) => {
      try {
        localStorage.setItem(draftStorageKey(schoolName), JSON.stringify(draft));
        setDraftSavedAt(draft.savedAt);
      } catch {
        // ignore
      }
    },
    [schoolName]
  );

  function applyDraft(d: EnrollmentDeskDraftV1) {
    restoringDraftRef.current = true;
    restoredSubjectIdsRef.current = d.selectedSubjectIds;

    const clampedStep =
      Number.isInteger(d.step) && d.step >= 1 && d.step <= STEPS.length ? d.step : 1;

    setWizardView("form");
    setKeptContextHint(false);
    setStep(clampedStep);

    setFullName(d.fullName);
    setDateOfBirth(d.dateOfBirth);
    setGender(d.gender);
    setParentName(d.parentName);
    setParentPhone(d.parentPhone);
    setParentEmail(d.parentEmail);
    setAllergies(d.allergies);
    setDisability(d.disability);
    setInsuranceProvider(d.insuranceProvider);
    setInsurancePolicy(d.insurancePolicy);

    setSubjectAcademicYear(d.subjectAcademicYear);
    setSubjectTerm(d.subjectTerm);
    setAssignSubjectsLater(Boolean(d.assignSubjectsLater));

    const classOk = classes.some((c) => c.id === d.classId);
    if (classOk) {
      setClassId(d.classId);
      setSelectedSubjectIds(d.selectedSubjectIds);
    } else {
      setClassId("");
      setSelectedSubjectIds([]);
      setAssignSubjectsLater(false);
    }

    // Photo is intentionally not restored.
    setPhotoDraft(null);
  }

  useEffect(() => {
    // Recovery prompt on initial load (don’t interrupt an open wizard).
    if (wizardOpen) return;
    try {
      const raw = localStorage.getItem(draftStorageKey(schoolName));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<EnrollmentDeskDraftV1> | null;
      if (!parsed || parsed.version !== 1) {
        localStorage.removeItem(draftStorageKey(schoolName));
        return;
      }
      const d = parsed as EnrollmentDeskDraftV1;
      if (!isMeaningfulDraft(d)) return;
      setRecoveryDraft(d);
      setShowRecoveryPrompt(true);
    } catch {
      // ignore
    }
  }, [schoolName, wizardOpen]);

  const closeWizard = useCallback(() => {
    if (pending) return;
    if (wizardView === "success") {
      setWizardOpen(false);
      resetWizard();
      clearDraft();
      return;
    }
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
    wizardView,
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
    clearDraft,
  ]);

  useEffect(() => {
    if (!classId) {
      setClassSubjectOptions([]);
      setSelectedSubjectIds([]);
      setAssignSubjectsLater(false);
      return;
    }
    const restoring = restoringDraftRef.current;
    if (!restoring) {
      setAssignSubjectsLater(false);
      setSelectedSubjectIds([]);
    }
    let cancelled = false;
    setSubjectsLoading(true);
    void getCaptureCardSubjectsForClass(classId).then((opts) => {
      if (cancelled) return;
      setClassSubjectOptions(opts);
      setSelectedSubjectIds((prev) => {
        if (restoringDraftRef.current && restoredSubjectIdsRef.current) {
          const fromDraft = restoredSubjectIdsRef.current.filter((id) =>
            opts.some((o) => o.id === id)
          );
          restoredSubjectIdsRef.current = null;
          restoringDraftRef.current = false;
          return fromDraft;
        }
        return prev.filter((id) => opts.some((o) => o.id === id));
      });
      setSubjectsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const isWizardMeaningful = useMemo(() => {
    return Boolean(
      fullName.trim() ||
        dateOfBirth ||
        classId ||
        parentName.trim() ||
        parentPhone.trim() ||
        parentEmail.trim() ||
        allergies.trim() ||
        disability.trim() ||
        insuranceProvider.trim() ||
        insurancePolicy.trim() ||
        selectedSubjectIds.length > 0 ||
        assignSubjectsLater
    );
  }, [
    fullName,
    dateOfBirth,
    classId,
    parentName,
    parentPhone,
    parentEmail,
    allergies,
    disability,
    insuranceProvider,
    insurancePolicy,
    selectedSubjectIds.length,
    assignSubjectsLater,
  ]);

  useEffect(() => {
    // Browser-level leave protection for refresh/close.
    if (!wizardOpen || wizardView !== "form" || !isWizardMeaningful) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for Chrome to show the confirmation dialog.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [wizardOpen, wizardView, isWizardMeaningful]);

  useEffect(() => {
    // Autosave draft while actively editing the wizard.
    if (!wizardOpen || wizardView !== "form") return;
    if (!isWizardMeaningful) return;

    const t = window.setTimeout(() => {
      const d: EnrollmentDeskDraftV1 = {
        version: 1,
        savedAt: Date.now(),
        step,
        fullName,
        dateOfBirth,
        gender,
        classId,
        subjectAcademicYear,
        subjectTerm,
        selectedSubjectIds,
        assignSubjectsLater,
        parentName,
        parentPhone,
        parentEmail,
        allergies,
        disability,
        insuranceProvider,
        insurancePolicy,
      };
      saveDraft(d);
    }, 350);
    return () => window.clearTimeout(t);
  }, [
    wizardOpen,
    wizardView,
    isWizardMeaningful,
    step,
    fullName,
    dateOfBirth,
    gender,
    classId,
    subjectAcademicYear,
    subjectTerm,
    selectedSubjectIds,
    assignSubjectsLater,
    parentName,
    parentPhone,
    parentEmail,
    allergies,
    disability,
    insuranceProvider,
    insurancePolicy,
    saveDraft,
  ]);

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
        setLastSubmitted({
          fullName: nameFormatted,
          className: classes.find((c) => c.id === classId)?.name ?? "—",
          requiresApproval,
        });
        setWizardView("success");
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

  const deskStats =
    enrollmentStats !== undefined ? enrollmentStats : DEFAULT_ENROLLMENT_STATS;

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
        <EnrollmentDeskStatsBanner stats={deskStats} />

        <CorrectionsNeededQueueSection correctionsQueue={correctionsQueue} />

        {showRecoveryPrompt && recoveryDraft && !wizardOpen ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Resume unfinished enrollment?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              We found a saved draft from your last session.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <CaptureButton
                type="button"
                onClick={() => {
                  applyDraft(recoveryDraft);
                  setShowRecoveryPrompt(false);
                  setWizardOpen(true);
                  toast.message("Photo must be added again.");
                }}
                className="w-full rounded-xl py-3 text-base font-semibold"
              >
                Resume draft
              </CaptureButton>
              <CaptureButton
                type="button"
                variant="outline"
                onClick={() => {
                  clearDraft();
                  openWizard();
                }}
                className="w-full rounded-xl py-3 text-base"
              >
                Start new
              </CaptureButton>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Latest submitted student
          </h2>
          {!latest ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">
              No submissions yet.
            </p>
          ) : latest.approval_status === "rejected" ? (
            <div
              className="mt-3 space-y-4 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-900/55 dark:bg-red-950/35 dark:text-red-50"
              role="status"
              aria-live="polite"
            >
              <div className="flex gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-red-100 bg-white dark:border-red-900/40 dark:bg-red-950/50">
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
                    <span className="text-lg font-semibold text-red-700 dark:text-red-200">
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
                  <p className="font-semibold leading-snug text-red-950 dark:text-red-50">
                    {latest.full_name}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-red-700/95 dark:text-red-100/85">
                    {latest.admission_number ?? "—"} ·{" "}
                    {latest.class?.name ?? "Class"} ·{" "}
                    {formatEnrollmentDateDisplay(latest.enrollment_date)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ApprovalBadge status="rejected" />
              </div>
              <RejectionGuidanceDisplay
                rejectionReason={latest.rejection_reason}
                density="comfortable"
              />
              <CaptureLinkButton
                href={`/capture-card/edit/${latest.id}`}
                variant="primary"
                size="sm"
                className="w-full min-h-11 justify-center rounded-xl py-3 text-base font-semibold"
              >
                Correct and resubmit
              </CaptureLinkButton>
            </div>
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
              filtered.slice(0, 12).map((s) => {
                const rejected = s.approval_status === "rejected";
                const rowTone = rejected
                  ? "border-red-200 bg-red-50/95 dark:border-red-900/50 dark:bg-red-950/30"
                  : "border-slate-100 bg-slate-50/80 dark:border-zinc-800 dark:bg-zinc-800/50";
                const nameCls = rejected
                  ? "truncate font-medium text-red-950 dark:text-red-50"
                  : "truncate font-medium text-slate-900 dark:text-white";
                const subCls = rejected
                  ? "truncate text-xs text-red-800 dark:text-red-100/85"
                  : "truncate text-xs text-slate-600 dark:text-zinc-400";
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-2xl border px-3 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between",
                      rowTone
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={nameCls}>{s.full_name}</p>
                      <p className={subCls}>{s.admission_number ?? "—"}</p>
                      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                        <ApprovalBadge status={s.approval_status} />
                        {rejected ? (
                          <p className="line-clamp-2 text-sm leading-snug text-red-700 dark:text-red-100/95">
                            {rejectionGuidancePlainSummary(s.rejection_reason, 140)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <CaptureLinkButton
                      href={`/capture-card/edit/${s.id}`}
                      variant={rejected ? "primary" : "outline"}
                      size="sm"
                      className="w-full min-h-10 shrink-0 justify-center rounded-xl py-2.5 font-semibold sm:w-auto sm:py-2"
                    >
                      {rejected ? "Correct" : "Edit"}
                    </CaptureLinkButton>
                  </div>
                );
              })
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
            {wizardView === "success" ? (
              <div className="mx-auto max-w-lg space-y-4 pt-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Student submitted successfully
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                        {lastSubmitted?.requiresApproval
                          ? "Sent for approval"
                          : "Enrolled successfully"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                    <p className="truncate">
                      <span className="font-medium text-slate-900 dark:text-white">
                        Student:{" "}
                      </span>
                      {lastSubmitted?.fullName ?? formatPersonName(fullName) ?? "—"}
                    </p>
                    <p className="truncate">
                      <span className="font-medium text-slate-900 dark:text-white">
                        Class:{" "}
                      </span>
                      {lastSubmitted?.className ??
                        classes.find((c) => c.id === classId)?.name ??
                        "—"}
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    <CaptureButton
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (pending) return;
                        resetWizardForNextStudent();
                      }}
                      className="w-full rounded-xl py-3 text-base font-semibold"
                    >
                      Enroll Next Student
                    </CaptureButton>
                    <CaptureButton
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        if (pending) return;
                        setWizardOpen(false);
                        resetWizard();
                        clearDraft();
                      }}
                      className="w-full rounded-xl py-3 text-base"
                    >
                      Back to Enrollment Desk
                    </CaptureButton>
                  </div>
                </div>
              </div>
            ) : null}

            {wizardView !== "success" && step === 1 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Student details
                </h3>
                {keptContextHint ? (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
                    Class and subjects were kept to speed up the next enrollment.
                  </p>
                ) : null}
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

            {wizardView !== "success" && step === 2 ? (
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

            {wizardView !== "success" && step === 3 ? (
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

            {wizardView !== "success" && step === 4 ? (
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

            {wizardView !== "success" && step === 5 ? (
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

            {wizardView !== "success" && step === 6 ? (
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

          {wizardView !== "success" ? (
            <div className="border-t border-slate-200 p-4 dark:border-zinc-800">
            <div className="mx-auto flex max-w-lg gap-3">
              {wizardView === "form" && draftSavedAt ? (
                <p className="sr-only">
                  Draft saved at {new Date(draftSavedAt).toISOString()}
                </p>
              ) : null}
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
