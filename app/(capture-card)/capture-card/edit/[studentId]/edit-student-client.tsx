"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
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

export function CaptureCardEditStudentClient({
  student,
  classes,
}: {
  student: EditStudentInitial;
  classes: { id: string; name: string }[];
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

  const readOnly = student.approval_status === "approved";

  function dirty() {
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
      photoDraft != null
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
      const fd = new FormData();
      fd.set("full_name", fullName);
      fd.set("date_of_birth", dateOfBirth);
      fd.set("class_id", classId);
      fd.set("gender", gender);
      fd.set("parent_name", parentName);
      fd.set("parent_phone", parentPhone);
      if (parentEmail.trim()) fd.set("parent_email", parentEmail);
      if (allergies.trim()) fd.set("allergies", allergies);
      if (disability.trim()) fd.set("disability", disability);
      if (insuranceProvider.trim()) {
        fd.set("insurance_provider", insuranceProvider);
      }
      if (insurancePolicy.trim()) fd.set("insurance_policy", insurancePolicy);

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
      <div className="mx-auto max-w-lg px-4 py-8">
        <CaptureButton
          type="button"
          variant="ghost"
          size="sm"
          className="px-0"
          onClick={() => router.push("/capture-card")}
        >
          ← Back
        </CaptureButton>
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
          Back to Capture Card
        </CaptureLinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24">
      <CaptureButton
        type="button"
        variant="ghost"
        size="sm"
        className="px-0"
        onClick={goBack}
      >
        ← Back
      </CaptureButton>
      <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
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

        <label className="block">
          <span className="text-sm font-medium">Allergies</span>
          <textarea
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Disability or support needs</span>
          <textarea
            value={disability}
            onChange={(e) => setDisability(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Health insurance (provider)</span>
          <input
            value={insuranceProvider}
            onChange={(e) => setInsuranceProvider(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Insurance policy number</span>
          <input
            value={insurancePolicy}
            onChange={(e) => setInsurancePolicy(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Parent or guardian name</span>
          <input
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Parent phone</span>
          <input
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Parent email (optional)</span>
          <input
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
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
  );
}
