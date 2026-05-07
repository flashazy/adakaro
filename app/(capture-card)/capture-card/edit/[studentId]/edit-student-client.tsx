"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getCaptureCardSubjectsForClass,
  updateCaptureCardStudentAction,
  uploadCaptureCardStudentPhotoAction,
} from "@/app/(capture-card)/capture-card-actions";
import {
  StudentPhotoPicker,
  type StudentPhotoDraft,
} from "@/components/students/StudentPhotoPicker";
import {
  CaptureButton,
  CaptureLinkButton,
} from "@/components/ui/capture-button";
import { EnrollmentDeskHeader } from "@/components/enrollment-desk/EnrollmentDeskHeader";
import { formatPersonName } from "@/lib/format-person-name";
import type { CaptureCardInitialSubjectEnrollment } from "@/lib/capture-card-initial-subject-enrollment";
import {
  SUBJECT_ENROLLMENT_TERMS,
  currentAcademicYear,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";
import { cn } from "@/lib/utils";

export interface EditStudentInitial {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  class_id: string;
  gender: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  allergies: string | null;
  disability: string | null;
  insurance_provider: string | null;
  insurance_policy: string | null;
  approval_status: string;
  avatar_url: string | null;
}

function subjectSelectionKey(
  year: number,
  term: SubjectEnrollmentTerm,
  ids: string[]
): string {
  return JSON.stringify({ year, term, ids: [...ids].sort() });
}

export function CaptureCardEditStudentClient({
  schoolName,
  schoolLogoUrl = null,
  schoolLogoVersion = null,
  student,
  classes,
  initialSubjectEnrollment,
}: {
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolLogoVersion?: number | null;
  student: EditStudentInitial;
  classes: { id: string; name: string }[];
  initialSubjectEnrollment: CaptureCardInitialSubjectEnrollment;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [photoDraft, setPhotoDraft] = useState<StudentPhotoDraft | null>(null);

  const [fullName, setFullName] = useState(student.full_name);
  const [dateOfBirth, setDateOfBirth] = useState(student.date_of_birth ?? "");
  const [classId, setClassId] = useState(student.class_id);
  const [gender, setGender] = useState<"male" | "female" | "">(
    student.gender === "male" || student.gender === "female"
      ? student.gender
      : ""
  );
  const [parentName, setParentName] = useState(student.parent_name ?? "");
  const [parentPhone, setParentPhone] = useState(student.parent_phone ?? "");
  const [parentEmail, setParentEmail] = useState(student.parent_email ?? "");
  const [allergies, setAllergies] = useState(student.allergies ?? "");
  const [disability, setDisability] = useState(student.disability ?? "");
  const [insuranceProvider, setInsuranceProvider] = useState(
    student.insurance_provider ?? ""
  );
  const [insurancePolicy, setInsurancePolicy] = useState(
    student.insurance_policy ?? ""
  );

  const [subjectAcademicYear, setSubjectAcademicYear] = useState(
    initialSubjectEnrollment.academic_year
  );
  const [subjectTerm, setSubjectTerm] = useState<SubjectEnrollmentTerm>(
    initialSubjectEnrollment.term
  );
  const [classSubjectOptions, setClassSubjectOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const subjectLoadGeneration = useRef(0);

  const academicYearOptions = useMemo(() => {
    const c = currentAcademicYear();
    const out: number[] = [];
    for (let y = c - 2; y <= c + 3; y++) out.push(y);
    return out;
  }, []);

  const initialSubjectKey = useMemo(
    () =>
      subjectSelectionKey(
        initialSubjectEnrollment.academic_year,
        initialSubjectEnrollment.term,
        initialSubjectEnrollment.subject_ids
      ),
    [initialSubjectEnrollment]
  );

  const readOnly = student.approval_status === "approved";

  useEffect(() => {
    if (!classId) return;
    subjectLoadGeneration.current += 1;
    const gen = subjectLoadGeneration.current;
    let cancelled = false;
    setSubjectsLoading(true);
    void getCaptureCardSubjectsForClass(classId).then((opts) => {
      if (cancelled || gen !== subjectLoadGeneration.current) return;
      setClassSubjectOptions(opts);
      setSelectedSubjectIds((prev) => {
        const filtered = prev.filter((id) =>
          opts.some((o) => o.id === id)
        );
        if (
          filtered.length === 0 &&
          prev.length === 0 &&
          classId === student.class_id
        ) {
          return initialSubjectEnrollment.subject_ids.filter((id) =>
            opts.some((o) => o.id === id)
          );
        }
        return filtered;
      });
      setSubjectsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [classId, student.class_id, initialSubjectEnrollment.subject_ids]);

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

  function toggleSubject(id: string, checked: boolean) {
    setSelectedSubjectIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleAllSubjects(checked: boolean) {
    setSelectedSubjectIds(
      checked ? classSubjectOptions.map((s) => s.id) : []
    );
  }

  function dirty() {
    const subjectDirty =
      subjectSelectionKey(subjectAcademicYear, subjectTerm, selectedSubjectIds) !==
      initialSubjectKey;
    return (
      fullName !== student.full_name ||
      dateOfBirth !== (student.date_of_birth ?? "") ||
      classId !== student.class_id ||
      gender !==
        (student.gender === "male" || student.gender === "female"
          ? student.gender
          : "") ||
      parentName !== (student.parent_name ?? "") ||
      parentPhone !== (student.parent_phone ?? "") ||
      parentEmail !== (student.parent_email ?? "") ||
      allergies !== (student.allergies ?? "") ||
      disability !== (student.disability ?? "") ||
      insuranceProvider !== (student.insurance_provider ?? "") ||
      insurancePolicy !== (student.insurance_policy ?? "") ||
      photoDraft != null ||
      subjectDirty
    );
  }

  function goBack() {
    if (
      dirty() &&
      !window.confirm("Discard your changes and go back?")
    ) {
      return;
    }
    router.push("/capture-card");
  }

  function save(resubmit: boolean) {
    if (pending) return;
    startTransition(async () => {
      const allergiesUpper = allergies.trim() ? allergies.trim().toUpperCase() : "";
      const disabilityUpper = disability.trim() ? disability.trim().toUpperCase() : "";
      const insuranceUpper = insuranceProvider.trim()
        ? insuranceProvider.trim().toUpperCase()
        : "";

      const fd = new FormData();
      fd.set("full_name", formatPersonName(fullName));
      fd.set("date_of_birth", dateOfBirth);
      fd.set("class_id", classId);
      fd.set("gender", gender);
      fd.set("parent_name", formatPersonName(parentName));
      fd.set("parent_phone", parentPhone);
      if (parentEmail.trim()) fd.set("parent_email", parentEmail);
      if (allergiesUpper) fd.set("allergies", allergiesUpper);
      if (disabilityUpper) fd.set("disability", disabilityUpper);
      if (insuranceUpper) {
        fd.set("insurance_provider", insuranceUpper);
      }
      if (insurancePolicy.trim()) fd.set("insurance_policy", insurancePolicy);

      fd.set("subject_sync", "1");
      fd.set("subject_academic_year", String(subjectAcademicYear));
      fd.set("subject_term", subjectTerm);
      for (const sid of selectedSubjectIds) {
        fd.append("subject_ids", sid);
      }

      const res = await updateCaptureCardStudentAction(student.id, fd, resubmit);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (photoDraft?.file) {
        const up = new FormData();
        up.set("avatar", photoDraft.file);
        const photoRes = await uploadCaptureCardStudentPhotoAction(
          student.id,
          up
        );
        if (photoRes.error) {
          toast.message("Saved, but photo upload failed.");
        }
        setPhotoDraft(null);
      }
      toast.success(
        "ok" in res && typeof res.message === "string"
          ? res.message
          : "Saved."
      );
      router.refresh();
      router.push("/capture-card");
    });
  }

  if (readOnly) {
    return (
      <div className="min-h-svh bg-slate-50 pb-24 dark:bg-zinc-950">
        <EnrollmentDeskHeader
          schoolName={schoolName}
          schoolLogoUrl={schoolLogoUrl}
          schoolLogoVersion={schoolLogoVersion}
          rightSlot={
            <CaptureButton
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => router.push("/capture-card")}
            >
              Back
            </CaptureButton>
          }
        />
        <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
          {student.full_name}
        </h1>
        <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
          Approved students can only be edited by an admin.
        </p>
        <CaptureLinkButton
          href="/capture-card"
          variant="primary"
          size="md"
          className="mt-6 inline-flex rounded-xl px-4 py-3 text-sm font-semibold"
        >
          Back to Enrollment Desk
        </CaptureLinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-slate-50 pb-24 dark:bg-zinc-950">
      <EnrollmentDeskHeader
        schoolName={schoolName}
        schoolLogoUrl={schoolLogoUrl}
        schoolLogoVersion={schoolLogoVersion}
        rightSlot={
          <CaptureButton
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            onClick={goBack}
          >
            Back
          </CaptureButton>
        }
        subtitle=""
      />
      <div className="mx-auto max-w-lg px-4 py-6 pb-40">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Edit student
        </h1>
      {student.approval_status === "rejected" ? (
        <p className="mt-2 text-sm text-red-800 dark:text-red-200">
          This record needs changes. Update the details, then send it for approval
          again.
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => setFullName((n) => formatPersonName(n))}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Date of birth</span>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Gender</legend>
          <div className="mt-2 flex gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="gender"
                checked={gender === "male"}
                onChange={() => setGender("male")}
              />
              Male
            </label>
            <label className="flex items-center gap-2">
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

        <div>
          <p className="text-sm font-medium">Photo</p>
          <StudentPhotoPicker
            studentName={fullName || "Student"}
            currentPhotoUrl={student.avatar_url}
            draft={photoDraft}
            onDraftChange={setPhotoDraft}
            disabled={pending}
            allowRemove={false}
          />
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-zinc-800">
          <label className="block">
            <span className="text-sm font-medium">Class</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Choose the class before assigning subjects.
          </p>
        </div>

        <div
          className={cn(
            "space-y-3 border-t border-slate-200 pt-4 dark:border-zinc-800"
          )}
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Subjects Selection
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Choose the subjects this student will study in the selected class.
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-500">
            Subjects can also be assigned later by an admin. Leave all
            unchecked to clear enrolment for this year and term.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
              Academic year
              <select
                value={subjectAcademicYear}
                onChange={(e) =>
                  setSubjectAcademicYear(Number(e.target.value))
                }
                className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
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
                className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
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
            <p className="text-xs text-amber-800 dark:text-amber-200/90">
              No subjects linked to this class yet.
            </p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
              <label
                htmlFor="edit-capture-subj-all"
                className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-slate-200/80 pb-3 touch-manipulation dark:border-zinc-700"
              >
                <input
                  ref={selectAllRef}
                  id="edit-capture-subj-all"
                  type="checkbox"
                  checked={allSubjectsSelected}
                  onChange={(e) => toggleAllSubjects(e.target.checked)}
                  className="h-5 w-5 shrink-0 rounded border-gray-300 text-school-primary focus:ring-school-primary dark:border-zinc-600"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                  Select all subjects
                </span>
                <span className="ml-auto text-xs text-slate-500 dark:text-zinc-400">
                  {selectedSubjectIds.length} of {classSubjectOptions.length}{" "}
                  selected
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
                      id={`edit-cap-subj-${sub.id}`}
                      checked={selectedSubjectIds.includes(sub.id)}
                      onChange={(e) =>
                        toggleSubject(sub.id, e.target.checked)
                      }
                      className="h-5 w-5 shrink-0 rounded border-gray-300 text-school-primary focus:ring-school-primary dark:border-zinc-600"
                    />
                    <label
                      htmlFor={`edit-cap-subj-${sub.id}`}
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

        <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Parent or guardian
          </h2>
          <label className="block">
            <span className="text-sm font-medium">Parent or guardian name</span>
            <input
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              onBlur={() => setParentName((n) => formatPersonName(n))}
              className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Parent phone</span>
            <input
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Parent email (optional)</span>
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              className="mt-1 w-full min-h-11 touch-manipulation rounded-xl border border-slate-200 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </label>
        </div>

        <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Health information
          </h2>
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
              onBlur={() =>
                setInsuranceProvider((p) =>
                  p.trim() ? p.trim().toUpperCase() : p
                )
              }
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
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          <CaptureButton
            type="button"
            disabled={pending}
            onClick={() => save(false)}
            loading={pending}
            loadingLabel="Saving…"
            className="w-full rounded-xl py-3 text-base font-semibold"
          >
            Save changes
          </CaptureButton>
          {student.approval_status === "rejected" ? (
            <CaptureButton
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => save(true)}
              loading={pending}
              loadingLabel="Saving…"
              className="w-full rounded-xl py-3 text-base font-medium"
            >
              Save and send for approval again
            </CaptureButton>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}
