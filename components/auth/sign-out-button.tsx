"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { signOut, type SignOutState } from "@/app/(auth)/actions";

const initialSignOut: SignOutState = {};

type SignOutButtonProps = {
  className: string;
  formClassName?: string;
};

export function SignOutButton({ className, formClassName }: SignOutButtonProps) {
  const [state, formAction, isPending] = useActionState(
    signOut,
    initialSignOut
  );
  return (
    <form action={formAction} className={formClassName ?? ""}>
      {state.error ? (
        <p
          className="mb-2 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={["inline-flex items-center justify-center gap-2", className]
          .filter(Boolean)
          .join(" ")}
      >
        {isPending ? (
          <>
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin"
              aria-hidden
            />
            Signing out...
          </>
        ) : (
          "Sign out"
        )}
      </button>
    </form>
  );
}
