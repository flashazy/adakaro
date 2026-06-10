/** Stable feature keys for health alerts and watchdog rules. */
export const HEALTH_FEATURES = {
  receiptGeneration: "receipt_generation",
  teacherPhone: "teacher_phone",
  reportCards: "report_cards",
  parentReportPublishing: "parent_report_publishing",
  classAttendance: "class_attendance",
  subjectAttendance: "subject_attendance",
  marks: "marks",
  auth: "auth",
  parentLogin: "parent_login",
  teacherLogin: "teacher_login",
  authCallback: "auth_callback",
  passwordRecovery: "password_recovery",
  captureCardLogin: "capture_card_login",
  profileAccess: "profile_access",
  teacherDashboard: "teacher_dashboard",
  parentDashboard: "parent_dashboard",
  healthCheck: "health_check",
  paymentSettlement: "payment_settlement",
  paymentReceipt: "payment_receipt",
  subjectEnrollmentDrift: "subject_enrollment_drift",
  subjectClassSync: "subject_class_sync",
  studentSubjectEnrollment: "student_subject_enrollment",
  parentProvisioning: "parent_provisioning",
  schoolCreation: "school_creation",
  parentDataLoad: "parent_data_load",
  teacherNotifications: "teacher_notifications",
  academicReports: "academic_reports",
  syllabusCoverage: "syllabus_coverage",
} as const;

export type HealthFeature =
  (typeof HEALTH_FEATURES)[keyof typeof HEALTH_FEATURES];
