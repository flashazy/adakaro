"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/** Route handler clears cookies on the redirect response (works on Vercel production). */
const SIGN_OUT_URL = "/api/auth/sign-out";

type SignOutButtonProps = {
  className: string;
  formClassName?: string;
};

export function SignOutButton({ className, formClassName }: SignOutButtonProps) {
  const [isPending, setIsPending] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    window.location.assign(SIGN_OUT_URL);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={formClassName ?? ""}
      noValidate
    >
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
