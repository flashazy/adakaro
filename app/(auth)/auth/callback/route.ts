import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const profileRole = (profileRow as { role: string } | null)?.role;

        const { data: rpcSuper, error: rpcSuperErr } = await supabase.rpc(
          "is_super_admin",
          {} as never
        );
        const isSuper =
          (!rpcSuperErr && rpcSuper === true) || profileRole === "super_admin";

        let destination = "/parent-dashboard";
        if (isSuper) {
          destination = "/super-admin";
        } else if (profileRole === "admin") {
          destination = "/dashboard";
        } else if (profileRole === "parent") {
          destination = "/parent-dashboard";
        } else {
          const metaAdmin =
            String(user.user_metadata?.role ?? "")
              .toLowerCase()
              .trim() === "admin";
          destination = metaAdmin ? "/dashboard" : "/parent-dashboard";
        }
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
