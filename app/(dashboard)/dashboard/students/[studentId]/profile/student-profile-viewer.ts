export type StudentProfileTabId =
  | "academic"
  | "discipline"
  | "health"
  | "finance";

export interface StudentProfileViewerFlags {
  canManageStaffRecords: boolean;
  canUploadAttachments: boolean;
  canDeleteAttachments: boolean;
  canChangeAvatar: boolean;
  /** Record a fee payment to `payments` (admin, finance/accounts role, or finance/accounts department). */
  canRecordPayment: boolean;
  visibleTabs: StudentProfileTabId[];
}
