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
  visibleTabs: StudentProfileTabId[];
}
