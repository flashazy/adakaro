/**
 * Unread "Subject results" indicators for a single linked child: derived from
 * `parent_viewed_results` and gradebook activity.
 */
export interface SubjectResultsUnreadState {
  totalUnviewed: number;
  bySubjectHasUnviewed: Record<string, boolean>;
  /** `assignment_id` → true when the parent has not "viewed" after latest activity */
  byAssignmentUnviewed: Record<string, boolean>;
  /** `assignment_id` → subject key (see `subjectTextKey`) for recomputing after a view */
  assignmentSubjectById: Record<string, string>;
}

/** Number of subjects that still have at least one unviewed assignment. */
function countSubjectsWithUnread(
  bySubjectHasUnviewed: Record<string, boolean>
): number {
  return Object.values(bySubjectHasUnviewed).filter(Boolean).length;
}

/**
 * Mark several assignments viewed in local state (after DB writes succeed).
 */
export function markSubjectResultAssignmentsViewed(
  state: SubjectResultsUnreadState,
  assignmentIds: string[]
): SubjectResultsUnreadState {
  if (assignmentIds.length === 0) return state;
  const byAssignmentUnviewed = { ...state.byAssignmentUnviewed };
  let touched = false;
  for (const id of assignmentIds) {
    if (byAssignmentUnviewed[id] === true) {
      byAssignmentUnviewed[id] = false;
      touched = true;
    }
  }
  if (!touched) return state;

  const bySubjectHasUnviewed = { ...state.bySubjectHasUnviewed };
  const subjectKeys = new Set(
    assignmentIds
      .map((id) => state.assignmentSubjectById[id])
      .filter((sk): sk is string => Boolean(sk?.length))
  );
  for (const subj of subjectKeys) {
    const anyLeft = Object.entries(state.assignmentSubjectById).some(
      ([aid, sk]) =>
        sk === subj && byAssignmentUnviewed[aid] === true
    );
    bySubjectHasUnviewed[subj] = anyLeft;
  }

  return {
    totalUnviewed: countSubjectsWithUnread(bySubjectHasUnviewed),
    bySubjectHasUnviewed,
    byAssignmentUnviewed,
    assignmentSubjectById: state.assignmentSubjectById,
  };
}

export function markSubjectResultAssignmentViewed(
  state: SubjectResultsUnreadState,
  assignmentId: string
): SubjectResultsUnreadState {
  return markSubjectResultAssignmentsViewed(state, [assignmentId]);
}

export function initialEmptySubjectResultsUnread(): SubjectResultsUnreadState {
  return {
    totalUnviewed: 0,
    bySubjectHasUnviewed: {},
    byAssignmentUnviewed: {},
    assignmentSubjectById: {},
  };
}
