/// Resolved navigation role for the mobile shell (mirrors web middleware intent).
enum AppRole {
  /// Full parent mobile experience (also used for admins who use parent features).
  parentMobile,

  /// Teacher: read-only mobile home (assignments, subjects, students per RLS).
  teacherMobile,

  /// School org admin without linked children — web dashboard.
  adminWeb,

  /// Platform super admin — web only.
  superAdminWeb,
}
