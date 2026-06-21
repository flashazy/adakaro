"use client";

import { SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";
import {
  buildSchoolBroadcastHref,
  buildSchoolContactsHref,
  buildSchoolProfileHref,
  saveIntelligenceScrollPosition,
  type SmartIntelligenceNavigationContext,
} from "@/lib/super-admin/smart-intelligence-navigation";
import {
  saBtnPrimarySm,
  saBtnSecondarySm,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";

export interface SchoolIntelligenceActionLinksProps {
  context: SmartIntelligenceNavigationContext;
  className?: string;
  compact?: boolean;
}

function linkWithScrollSave(href: string, onNavigate?: () => void) {
  return () => {
    saveIntelligenceScrollPosition();
    onNavigate?.();
  };
}

export function SchoolIntelligenceActionLinks({
  context,
  className,
  compact = false,
}: SchoolIntelligenceActionLinksProps) {
  const contactsHref = buildSchoolContactsHref(context);
  const broadcastHref = buildSchoolBroadcastHref(context);
  const profileHref = buildSchoolProfileHref(context.schoolId);

  const btnClass = compact ? "text-xs" : "text-xs";

  return (
    <div className={cn("flex flex-wrap gap-2 pt-2", className)}>
      <SuperAdminNavLink
        href={profileHref}
        loadingLabel="Opening school…"
        className={cn(saBtnPrimarySm, btnClass)}
        onClick={linkWithScrollSave(profileHref)}
      >
        Open school profile
      </SuperAdminNavLink>
      <SuperAdminNavLink
        href={contactsHref}
        loadingLabel="Opening contacts…"
        className={cn(saBtnSecondarySm, btnClass)}
        onClick={linkWithScrollSave(contactsHref)}
      >
        Contact school
      </SuperAdminNavLink>
      <SuperAdminNavLink
        href={broadcastHref}
        loadingLabel="Preparing follow-up…"
        className={cn(saBtnSecondarySm, btnClass)}
        onClick={linkWithScrollSave(broadcastHref)}
      >
        Send follow-up
      </SuperAdminNavLink>
    </div>
  );
}
