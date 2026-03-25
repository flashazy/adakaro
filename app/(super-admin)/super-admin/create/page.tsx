import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { CreateSchoolForm } from "./create-school-form";

export const dynamic = "force-dynamic";

export default async function SuperAdminCreateSchoolPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col justify-center bg-slate-50 px-4 py-10 sm:px-6 lg:px-8 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/super-admin"
          className="mb-8 inline-flex text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          ← Back to dashboard
        </Link>

        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Create school
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Creates a school and assigns the chosen user as founding admin. They
            must already have an account (profile) with the admin email you
            enter.
          </p>
        </header>

        <CreateSchoolForm />
      </div>
    </div>
  );
}
