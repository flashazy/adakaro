import { loadPromotionsPageForUser } from "@/lib/promotions/load-promotions-page-for-user.server";
import { PromotionsPageView } from "./promotions-page-view";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  const props = await loadPromotionsPageForUser();
  return <PromotionsPageView {...props} />;
}
