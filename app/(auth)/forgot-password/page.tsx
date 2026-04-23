import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Forgot login details — Adakaro",
};

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Forgot login details
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
        We&apos;ll verify you with your child&apos;s admission number and the
        phone number on your account. You&apos;ll receive a short code on this
        screen — no SMS.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-zinc-400">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-medium text-school-primary hover:opacity-90"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
