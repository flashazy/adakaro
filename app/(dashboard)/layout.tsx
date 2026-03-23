import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default async function DashboardGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullName =
    (profile as { full_name: string } | null)?.full_name?.trim() || "User";

  return (
    <>
      <a
        href="#page-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <DashboardHeader fullName={fullName} />
      <div id="page-content">{children}</div>
    </>
  );
}
