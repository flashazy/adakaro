"use client";

import { useActionState } from "react";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { submitContactForm, type ContactFormState } from "./actions";
import { DEMO_REQUEST_SCHOOL_TYPES } from "@/lib/demo-requests/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[160px]"
    >
      {pending ? "Submitting…" : "Request Demo"}
    </button>
  );
}

const initialState: ContactFormState = {};

const fieldClassName =
  "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 sm:py-2.5 sm:text-sm";

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-xl sm:p-8">
      {state.ok ? (
        <div
          className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200 sm:mb-6"
          role="status"
        >
          <p className="font-semibold">
            Thank you. Your demo request has been received. Adakaro will contact
            you shortly.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <div
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 sm:mb-6"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      <form
        id="contact-demo-form"
        ref={formRef}
        action={formAction}
        className="space-y-4 sm:space-y-5"
      >
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            className={fieldClassName}
            placeholder="Your full name"
          />
        </div>

        <div>
          <label
            htmlFor="schoolName"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            School Name <span className="text-red-500">*</span>
          </label>
          <input
            id="schoolName"
            name="schoolName"
            type="text"
            required
            className={fieldClassName}
            placeholder="Your school name"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Phone / WhatsApp Number <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            className={fieldClassName}
            placeholder="+255 7XX XXX XXX"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className={fieldClassName}
            placeholder="you@school.com"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          <div>
            <label
              htmlFor="schoolType"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              School Type
            </label>
            <select
              id="schoolType"
              name="schoolType"
              defaultValue=""
              className={fieldClassName}
            >
              <option value="">Select school type</option>
              {DEMO_REQUEST_SCHOOL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="studentCount"
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Number of Students
            </label>
            <input
              id="studentCount"
              name="studentCount"
              type="number"
              min={0}
              step={1}
              className={fieldClassName}
              placeholder="e.g. 450"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="message"
            className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
          >
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            className={`${fieldClassName} resize-y`}
            placeholder="Tell us about your school and what you would like to see in a demo…"
          />
        </div>

        <div className="pt-1">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
