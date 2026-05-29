import {
  BarChart3,
  GraduationCap,
  Users,
} from "lucide-react";
import {
  ACADEMIC_PROMOTIONS,
  ACADEMIC_REPORTS,
  ACADEMIC_STUDENT_PROFILES,
} from "@/lib/academic/academic-hub-paths";
import { academicSectionHeadingHeroClass } from "./academic-ui-styles";
import { AcademicQuickActionCard } from "./academic-quick-action-card";

interface AcademicQuickActionsProps {
  showPromotions: boolean;
}

export function AcademicQuickActions({
  showPromotions,
}: AcademicQuickActionsProps) {
  const actions = [
    {
      href: ACADEMIC_STUDENT_PROFILES,
      title: "View Students",
      description: "Browse student profiles and department records.",
      icon: <Users className="text-violet-600 dark:text-violet-400" aria-hidden />,
      emphasized: true,
    },
    {
      href: ACADEMIC_REPORTS,
      title: "Academic Reports",
      description: "Review class performance summaries by term.",
      icon: <BarChart3 className="text-indigo-600 dark:text-indigo-400" aria-hidden />,
    },
  ];

  if (showPromotions) {
    actions.push({
      href: ACADEMIC_PROMOTIONS,
      title: "Promotions",
      description: "Review readiness and promote classes for the new year.",
      icon: (
        <GraduationCap className="text-emerald-600 dark:text-emerald-400" aria-hidden />
      ),
    });
  }

  return (
    <section aria-label="Quick actions">
      <h2 className={academicSectionHeadingHeroClass}>Quick actions</h2>
      <div
        className={`mt-3 grid gap-3 ${
          actions.length >= 3
            ? "sm:grid-cols-2 lg:grid-cols-3"
            : "sm:grid-cols-2"
        }`}
      >
        {actions.map((action) => (
          <AcademicQuickActionCard
            key={action.href}
            href={action.href}
            title={action.title}
            description={action.description}
            icon={action.icon}
            emphasized={"emphasized" in action && action.emphasized}
          />
        ))}
      </div>
    </section>
  );
}
