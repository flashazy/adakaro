import { loadAcademicPromotionDisplayOverview } from "@/lib/academic/academic-promotions-display.server";
import {
  getPromotionsDataClient,
  resolvePromotionsSchoolId,
} from "@/lib/promotions/promotions-access.server";
import { loadPromotionsPageForUser } from "@/lib/promotions/load-promotions-page-for-user.server";
import { createClient } from "@/lib/supabase/server";
import { PromotionsHubPanel } from "./promotions-hub-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Promotions — Academic",
};

export default async function AcademicPromotionsPage() {
  const props = await loadPromotionsPageForUser();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let promotionDisplayOverview = null;
  if (user) {
    const schoolId = await resolvePromotionsSchoolId(supabase, user.id);
    if (schoolId) {
      const db = getPromotionsDataClient(supabase);
      promotionDisplayOverview = await loadAcademicPromotionDisplayOverview(
        db,
        schoolId,
        props.classes,
        props.academicYear
      );
    }
  }

  return (
    <PromotionsHubPanel
      {...props}
      promotionDisplayOverview={promotionDisplayOverview}
    />
  );
}
