import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import type { Database } from "@/types/supabase";

export async function requireSuperAdminDataClient(): Promise<
  | { error: NextResponse }
  | { dataClient: SupabaseClient<Database>; userId: string }
> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  if (!(await checkIsSuperAdmin(authClient, user.id))) {
    return {
      error: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  try {
    return { dataClient: createAdminClient(), userId: user.id };
  } catch (err) {
    console.error("[ai-training] admin client unavailable:", err);
    return { dataClient: authClient, userId: user.id };
  }
}
