import { createRequire } from "module";

const require = createRequire(import.meta.url);
require("dotenv").config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = "12345678";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(
    'Resetting ALL capture_card_users passwords to default "12345678"...'
  );

  const { data: rows, error } = await supabase
    .from("capture_card_users")
    .select("id");

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const users = (rows ?? []).filter((r) => r?.id);
  console.log(`Found ${users.length} capture_card_users row(s).`);

  let ok = 0;
  for (const r of users) {
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const { error: upErr } = await supabase
      .from("capture_card_users")
      .update({ password_hash: hash })
      .eq("id", r.id);

    if (upErr) {
      console.error(`Failed to update ${r.id}:`, upErr.message);
      continue;
    }
    ok++;
  }

  console.log(`Done. Updated ${ok}/${users.length}.`);
}

main().catch((e) => {
  console.error("Unexpected failure:", e);
  process.exit(1);
});

