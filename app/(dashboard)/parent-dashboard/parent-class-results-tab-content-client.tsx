"use client";

import type { Dispatch, SetStateAction } from "react";
import { ParentClassResultsTabClient } from "./parent-class-results-tab-client";
import type { ParentMajorExamClassResultsPayload } from "@/lib/parent-major-exam-class-results-types";
import type { SubjectResultsUnreadState } from "@/lib/parent-subject-results-unread-types";
import { initialEmptySubjectResultsUnread } from "@/lib/parent-subject-results-unread-types";

const noopUnreadChange = (() => {}) as Dispatch<
  SetStateAction<SubjectResultsUnreadState>
>;

export function ParentClassResultsTabContent({
  studentId,
  classId,
  classResultSubjects,
  majorExamClassResults,
  subjectResultsUnread = initialEmptySubjectResultsUnread(),
  onSubjectResultsUnreadChange,
}: {
  studentId: string;
  classId: string;
  classResultSubjects: string[];
  majorExamClassResults: ParentMajorExamClassResultsPayload;
  subjectResultsUnread?: SubjectResultsUnreadState;
  onSubjectResultsUnreadChange?: Dispatch<
    SetStateAction<SubjectResultsUnreadState>
  >;
}) {
  return (
    <ParentClassResultsTabClient
      studentId={studentId}
      classId={classId}
      classResultSubjects={classResultSubjects}
      initialPayload={majorExamClassResults}
      subjectResultsUnread={subjectResultsUnread}
      onSubjectResultsUnreadChange={
        onSubjectResultsUnreadChange ?? noopUnreadChange
      }
    />
  );
}
