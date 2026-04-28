import type { UserRole } from "@/types/supabase";

/** Second line in "Recorded by" for student profile — Admin, Finance, Accounts, etc. */
function paymentRecorderRoleLabel(role: UserRole | null | undefined): string {
  switch (role) {
    case "admin":
    case "super_admin":
      return "Admin";
    case "finance":
      return "Finance";
    case "accounts":
      return "Accounts";
    case "teacher":
      return "Teacher";
    case "parent":
      return "Parent";
    default:
      return "—";
  }
}

/** e.g. `Madam seni (Admin)` — name as stored, role label in parentheses. */
export function formatPaymentRecorderLine(
  fullName: string | null | undefined,
  role: UserRole | null | undefined
): string {
  const name = fullName?.trim() ?? "";
  const hasName = name.length > 0;
  const hasRole = role != null;
  if (!hasName && !hasRole) {
    return "Legacy payment";
  }
  return `${hasName ? name : "Unknown"} (${paymentRecorderRoleLabel(role)})`;
}
