"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AdminQuickActionCard } from "@/components/dashboard/admin-quick-action-card";
import { schoolSettingsVisitedKey } from "@/lib/dashboard/school-setup-onboarding";

interface SchoolSettingsOnboardingCardProps {
  schoolId: string;
  schoolProfileComplete: boolean;
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}

export function SchoolSettingsOnboardingCard({
  schoolId,
  schoolProfileComplete,
  href,
  title,
  description,
  icon,
}: SchoolSettingsOnboardingCardProps) {
  const [showOnboardingHint, setShowOnboardingHint] = useState(
    !schoolProfileComplete
  );

  useEffect(() => {
    if (schoolProfileComplete) {
      setShowOnboardingHint(false);
      return;
    }

    try {
      const visited = localStorage.getItem(schoolSettingsVisitedKey(schoolId));
      if (visited === "1") {
        setShowOnboardingHint(false);
      }
    } catch {
      // Keep hint visible if storage is unavailable.
    }
  }, [schoolId, schoolProfileComplete]);

  return (
    <AdminQuickActionCard
      href={href}
      title={title}
      description={description}
      icon={icon}
      metaChip={showOnboardingHint ? "Start here" : undefined}
      metaChipTone={showOnboardingHint ? "primary" : "default"}
    />
  );
}
