/**
 * Serializable parent credential slip shown once after enrollment (no secrets persisted client-side).
 */
export type ParentCredentialSheetPayload =
  | {
      kind: "existing";
      parentName: string;
      parentPhoneDisplay: string;
      studentName: string;
      admissionNumber: string;
      schoolName: string;
      message: string;
    }
  | {
      kind: "new";
      parentName: string;
      parentPhoneDisplay: string;
      studentName: string;
      admissionNumber: string;
      username: string;
      temporaryPassword: string;
      schoolName: string;
      /** Absolute URL when configured server-side; empty means use `window.location.origin` + `/login`. */
      loginUrl: string;
    };
