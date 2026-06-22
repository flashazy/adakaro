"use client";

import { useActionState } from "react";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { submitContactForm, type ContactFormState } from "./actions";
import { DEMO_REQUEST_SCHOOL_TYPES } from "@/lib/demo-requests/types";
import {
  CONTACT_CARD_CLASS,
  CONTACT_FIELD_CLASS,
  CONTACT_FIELD_TEXTAREA_CLASS,
  CONTACT_LABEL_CLASS,
} from "./contact-ui";

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

const alertClass =
  "mb-5 rounded-lg border px-4 py-3 text-sm leading-relaxed sm:mb-6";

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <div className={CONTACT_CARD_CLASS}>
      {state.ok ? (
        <div
          className={`${alertClass} border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200`}
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
          className={`${alertClass} border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300`}
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
          <label htmlFor="fullName" className={CONTACT_LABEL_CLASS}>
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            className={CONTACT_FIELD_CLASS}
            placeholder="Your full name"
          />
        </div>

        <div>
          <label htmlFor="schoolName" className={CONTACT_LABEL_CLASS}>
            School Name <span className="text-red-500">*</span>
          </label>
          <input
            id="schoolName"
            name="schoolName"
            type="text"
            required
            className={CONTACT_FIELD_CLASS}
            placeholder="Your school name"
          />
        </div>

        <div>
          <label htmlFor="phone" className={CONTACT_LABEL_CLASS}>
            Phone / WhatsApp Number <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            className={CONTACT_FIELD_CLASS}
            placeholder="+255 7XX XXX XXX"
          />
        </div>

        <div>
          <label htmlFor="email" className={CONTACT_LABEL_CLASS}>
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className={CONTACT_FIELD_CLASS}
            placeholder="you@school.com"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          <div>
            <label htmlFor="schoolType" className={CONTACT_LABEL_CLASS}>
              School Type
            </label>
            <select
              id="schoolType"
              name="schoolType"
              defaultValue=""
              className={CONTACT_FIELD_CLASS}
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
            <label htmlFor="studentCount" className={CONTACT_LABEL_CLASS}>
              Number of Students
            </label>
            <input
              id="studentCount"
              name="studentCount"
              type="number"
              min={0}
              step={1}
              className={CONTACT_FIELD_CLASS}
              placeholder="e.g. 450"
            />
          </div>
        </div>

        <div>
          <label htmlFor="message" className={CONTACT_LABEL_CLASS}>
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            className={CONTACT_FIELD_TEXTAREA_CLASS}
            placeholder="Tell us about your school and what you would like to see in a demo…"
          />
        </div>

        <div className="pt-0.5">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
