export const DUTY_BOOK_EVENT_TYPES = [
  "incident",
  "guest",
  "announcement",
  "other",
] as const;

export type DutyBookEventType = (typeof DUTY_BOOK_EVENT_TYPES)[number];

export interface DutyBookEvent {
  id: string;
  time: string;
  type: DutyBookEventType;
  description: string;
  /** Profile id of teacher who recorded the event; null for unknown legacy rows. */
  recordedById?: string | null;
  /** Resolved display name (populated when loading reports). */
  recordedByName?: string | null;
}

export const DUTY_BOOK_EVENT_TYPE_LABELS: Record<DutyBookEventType, string> = {
  incident: "Incident",
  guest: "Guest",
  announcement: "Announcement",
  other: "Other",
};

export interface DutyBookReportRow {
  id: string;
  schoolId: string;
  reportDate: string;
  events: DutyBookEvent[];
  remarks: string | null;
  headTeacherComment: string | null;
  headTeacherSignature: string | null;
  headTeacherId: string | null;
  signedAt: string | null;
  createdBy: string;
  remarksLastModifiedById: string | null;
  remarksLastModifiedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DutyBookReportSigner {
  id: string;
  fullName: string;
}

export interface DutyBookReportPayload {
  report: DutyBookReportRow | null;
  signer: DutyBookReportSigner | null;
}

export interface DutyBookReportPermissions {
  canView: boolean;
  canEdit: boolean;
  canSign: boolean;
  canExport: boolean;
  isSchoolAdmin: boolean;
  /** Temporary Teacher on Duty (not admin / head teacher). */
  isTeacherOnDuty: boolean;
}
