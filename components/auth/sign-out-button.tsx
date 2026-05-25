"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signOut, type SignOutState } from "@/app/(auth)/actions";

const initialSignOut: SignOutState = {};

type SignOutButtonProps = {
  className: string;
  formClassName?: string;
};

export function SignOutButton({ className, formClassName }: SignOutButtonProps) {
  const router = useRouter();
  const navigatedRef = useRef(false);
  const [state, formAction, isPending] = useActionState(signOut, initialSignOut);

  useEffect(() => {
    if (state.error) {
      navigatedRef.current = false;
      toast.error(state.error);
      return;
    }
    if (state.ok && !navigatedRef.current) {
      navigatedRef.current = true;
      router.push("/login");
      router.refresh();
    }
  }, [state, router]);

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
