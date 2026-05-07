"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  createCaptureCardStudentAction,
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
import { useFormStatus } from "react-dom";

function LogoutButton({ error }: { error?: string }) {
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);
  return (
    <CaptureButton
      type="submit"
      variant="outline"
      size="sm"
      className="h-10"
      loading={pending}
      loadingLabel="Logging out…"
    >
      Log out
    </CaptureButton>
  );
}

const STEPS = [
  "Student",
  "Photo",
  "Health",
  "Parent",
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
      photoDraft != null;
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
  ]);

  function submitEnrollment() {
    if (pending) return;
    const nameFormatted = formatPersonName(fullName);
    const parentFormatted = formatPersonName(parentName);
    const insuranceFormatted = insuranceProvider.trim()
      ? formatPersonName(insuranceProvider)
      : "";
    setFullName(nameFormatted);
    setParentName(parentFormatted);
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
      if (allergies.trim()) fd.set("allergies", allergies);
      if (disability.trim()) fd.set("disability", disability);
      if (insuranceFormatted) {
        fd.set("insurance_provider", insuranceFormatted);
      }
      if (insurancePolicy.trim()) fd.set("insurance_policy", insurancePolicy);

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
      ? fullName.trim() &&
        dateOfBirth &&
        classId &&
        (gender === "male" || gender === "female")
      : step === 2
        ? true
        : step === 3
          ? true
          : step === 4
            ? parentName.trim() && parentPhone.trim()
            : true;

  return (
    <div className="min-h-svh bg-slate-50 pb-24 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              {schoolName}
            </p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Capture Card
            </h1>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Enroll students quickly and safely.
            </p>
          </div>
          <form action={logoutAction}>
            <LogoutButton error={logoutState?.error} />
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-8 px-4 py-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Latest student
          </h2>
          {!latest ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">
              No students captured yet.
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
                  {latest.approval_status !== "approved" ? (
                    <CaptureLinkButton
                      href={`/capture-card/edit/${latest.id}`}
                      variant="primary"
                      size="sm"
                    >
                      Edit
                    </CaptureLinkButton>
                  ) : null}
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
                  {s.approval_status !== "approved" ? (
                    <CaptureLinkButton
                      href={`/capture-card/edit/${s.id}`}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      Edit
                    </CaptureLinkButton>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-500 dark:text-zinc-500">
                      Approved
                    </span>
                  )}
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
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Step {step} of {STEPS.length}
            </p>
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
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Class
                  </span>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  >
                    <option value="">Choose a class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Student photo
                </h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  Optional. You can skip this step.
                </p>
                <StudentPhotoPicker
                  studentName={fullName || "Student"}
                  draft={photoDraft}
                  onDraftChange={setPhotoDraft}
                  disabled={pending}
                  allowRemove={false}
                />
              </div>
            ) : null}

            {step === 3 ? (
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
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Disability or support needs</span>
                  <textarea
                    value={disability}
                    onChange={(e) => setDisability(e.target.value)}
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
                        p.trim() ? formatPersonName(p) : p
                      );
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Insurance policy number</span>
                  <input
                    value={insurancePolicy}
                    onChange={(e) => setInsurancePolicy(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Parent or guardian
                </h3>
                <label className="block">
                  <span className="text-sm font-medium">Name</span>
                  <input
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    onBlur={() => {
                      setParentName((n) => formatPersonName(n));
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Phone</span>
                  <input
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    inputMode="tel"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Email (optional)</span>
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                </label>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="mx-auto max-w-lg space-y-4 pt-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Review
                </h3>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-zinc-300">
                  <li>
                    <span className="font-medium text-slate-900 dark:text-white">
                      Name:{" "}
                    </span>
                    {fullName}
                  </li>
                  <li>
                    <span className="font-medium text-slate-900 dark:text-white">
                      Class:{" "}
                    </span>
                    {classes.find((c) => c.id === classId)?.name ?? "—"}
                  </li>
                  <li>
                    <span className="font-medium text-slate-900 dark:text-white">
                      Date of birth:{" "}
                    </span>
                    {dateOfBirth}
                  </li>
                  <li>
                    <span className="font-medium text-slate-900 dark:text-white">
                      Parent phone:{" "}
                    </span>
                    {parentPhone}
                  </li>
                </ul>
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
                      setInsuranceProvider((p) =>
                        p.trim() ? formatPersonName(p) : p
                      );
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
                  disabled={pending || !stepValid}
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
