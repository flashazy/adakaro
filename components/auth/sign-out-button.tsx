"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/app/(auth)/actions";

type SignOutButtonProps = {
  className: string;
  formClassName?: string;
};

function redirectToLogin(): void {
  window.location.assign("/login");
}

export function SignOutButton({ className, formClassName }: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInlineMessage(null);

    startTransition(async () => {
      try {
        const result = await signOut({}, new FormData());
        if (result.warnings?.length) {
          const summary = result.warnings.join(" ");
          console.warn("[SignOutButton] completed with warnings", result.warnings);
          toast.warning(summary);
          setInlineMessage(summary);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Sign-out request failed.";
        console.error("[SignOutButton] signOut threw", err);
        toast.warning(`${message} Redirecting to login…`);
        setInlineMessage(message);
      } finally {
        redirectToLogin();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={formClassName ?? ""}
      noValidate
    >
      {inlineMessage ? (
        <p
          className="mb-2 text-sm text-amber-700 dark:text-amber-300"
          role="status"
        >
          {inlineMessage}
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
