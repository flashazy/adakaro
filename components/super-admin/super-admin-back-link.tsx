"use client";

import { SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";

export function SuperAdminBackLink({
  href = "/super-admin",
  children = "← Back to dashboard",
  loadingLabel = "Loading…",
  className,
}: {
  href?: string;
  children?: React.ReactNode;
  loadingLabel?: string;
  className?: string;
}) {
  return (
    <SuperAdminNavLink
      href={href}
      loadingLabel={loadingLabel}
      className={className}
    >
      {children}
    </SuperAdminNavLink>
  );
}
