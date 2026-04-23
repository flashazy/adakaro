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

export function markSubjectResultAssignmentViewed(
  state: SubjectResultsUnreadState,
  assignmentId: string
): SubjectResultsUnreadState {
  if (state.byAssignmentUnviewed[assignmentId] !== true) {
    return state;
  }
  const byAssignmentUnviewed = {
    ...state.byAssignmentUnviewed,
    [assignmentId]: false,
  };
  const subj = state.assignmentSubjectById[assignmentId];
  const bySubjectHasUnviewed: Record<string, boolean> = { ...state.bySubjectHasUnviewed };
  if (subj) {
    const anyLeft = Object.entries(state.assignmentSubjectById).some(
      ([aid, sk]) => sk === subj && byAssignmentUnviewed[aid]
    );
    bySubjectHasUnviewed[subj] = anyLeft;
  }
  const totalUnviewed = Object.values(byAssignmentUnviewed).filter(Boolean).length;
  return {
    totalUnviewed,
    bySubjectHasUnviewed,
    byAssignmentUnviewed,
    assignmentSubjectById: state.assignmentSubjectById,
  };
}

export function initialEmptySubjectResultsUnread(): SubjectResultsUnreadState {
  return {
    totalUnviewed: 0,
    bySubjectHasUnviewed: {},
    byAssignmentUnviewed: {},
    assignmentSubjectById: {},
  };
}
