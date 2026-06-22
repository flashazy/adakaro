"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Calendar,
  Headphones,
  Loader2,
  MessageCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTACT_FIELD_CLASS,
  CONTACT_FIELD_TEXTAREA_CLASS,
  CONTACT_LABEL_CLASS,
} from "./contact-ui";
import {
  ADAKARO_WHATSAPP_DISPLAY,
  buildDemoWhatsAppMessage,
  buildSupportWhatsAppMessage,
  openWhatsAppChat,
} from "./contact-whatsapp-utils";
import { submitWhatsAppLead } from "./whatsapp-actions";

type ModalStep = "choose" | "demo" | "support";

const emptyDemoForm = {
  fullName: "",
  schoolName: "",
  phone: "",
  studentCount: "",
  message: "",
};

const emptySupportForm = {
  fullName: "",
  schoolName: "",
  phone: "",
  issue: "",
};

const DEMO_MESSAGE_PLACEHOLDER = `Examples:
• Report Cards
• Student Management
• Attendance Tracking
• School Finance
• Parent Portal`;

const SUPPORT_ISSUE_PLACEHOLDER = `Examples:
• Student streaming is not working
• Report cards are not generating
• Fee balances are incorrect
• Unable to access my account`;

const OPENING_DELAY_MS = 450;

function getModalCopy(step: ModalStep): { title: string; subtitle: string } {
  switch (step) {
    case "demo":
      return {
        title: "Request a Demo",
        subtitle:
          "Tell us about your school and we'll prepare your demo request.",
      };
    case "support":
      return {
        title: "Get Support",
        subtitle: "Describe your issue and we'll connect you with support.",
      };
    default:
      return {
        title: "How can we help?",
        subtitle:
          "Choose an option and we'll open WhatsApp with your details ready to send.",
      };
  }
}

interface ContactWhatsAppModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactWhatsAppModal({
  open,
  onClose,
}: ContactWhatsAppModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<ModalStep>("choose");
  const [demoForm, setDemoForm] = useState(emptyDemoForm);
  const [supportForm, setSupportForm] = useState(emptySupportForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);

  const modalCopy = getModalCopy(step);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  function resetState() {
    setStep("choose");
    setDemoForm(emptyDemoForm);
    setSupportForm(emptySupportForm);
    setErrors({});
    setSubmitting(false);
    setSaveWarning(false);
  }

  const completeClose = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => {
      resetState();
      onClose();
    }, 200);
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    completeClose();
  }, [submitting, completeClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose, submitting]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function handleBack() {
    if (submitting) return;
    setErrors({});
    setStep("choose");
  }

  function validateDemo(): boolean {
    const next: Record<string, string> = {};
    if (!demoForm.fullName.trim()) next.fullName = "Full name is required.";
    if (!demoForm.schoolName.trim()) next.schoolName = "School name is required.";
    if (!demoForm.phone.trim()) next.phone = "Phone / WhatsApp number is required.";
    if (!demoForm.message.trim()) {
      next.message = "Please tell us what you'd like to see during the demo.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateSupport(): boolean {
    const next: Record<string, string> = {};
    if (!supportForm.fullName.trim()) next.fullName = "Full name is required.";
    if (!supportForm.schoolName.trim()) next.schoolName = "School name is required.";
    if (!supportForm.phone.trim()) next.phone = "Phone / WhatsApp number is required.";
    if (!supportForm.issue.trim()) next.issue = "Please describe your support issue.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleDemoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !validateDemo()) return;

    setSubmitting(true);
    setSaveWarning(false);

    const saveResult = await submitWhatsAppLead({
      request_type: "demo",
      full_name: demoForm.fullName,
      school_name: demoForm.schoolName,
      phone: demoForm.phone,
      student_count: demoForm.studentCount
        ? Number.parseInt(demoForm.studentCount, 10)
        : null,
      message: demoForm.message,
    });

    if (!saveResult.saved) {
      setSaveWarning(true);
    }

    const message = buildDemoWhatsAppMessage(demoForm);
    await new Promise((resolve) =>
      window.setTimeout(resolve, saveResult.saved ? OPENING_DELAY_MS : 2000)
    );
    openWhatsAppChat(message);
    completeClose();
  }

  async function handleSupportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !validateSupport()) return;

    setSubmitting(true);
    setSaveWarning(false);

    const saveResult = await submitWhatsAppLead({
      request_type: "support",
      full_name: supportForm.fullName,
      school_name: supportForm.schoolName,
      phone: supportForm.phone,
      message: supportForm.issue,
    });

    if (!saveResult.saved) {
      setSaveWarning(true);
    }

    const message = buildSupportWhatsAppMessage(supportForm);
    await new Promise((resolve) =>
      window.setTimeout(resolve, saveResult.saved ? OPENING_DELAY_MS : 2000)
    );
    openWhatsAppChat(message);
    completeClose();
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6",
        "transition-opacity duration-200 ease-out",
        visible ? "opacity-100" : "opacity-0"
      )}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity"
        aria-label="Close dialog"
        onClick={handleClose}
        disabled={submitting}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-modal-title"
        aria-busy={submitting}
        className={cn(
          "relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-md min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900",
          "transition-[transform,opacity] duration-200 ease-out",
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0 sm:translate-y-0"
        )}
      >
        {/* Header — always visible */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0 pr-2">
            {step !== "choose" ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className="mb-2 inline-flex items-center gap-1 rounded-md text-xs font-medium text-slate-500 transition hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back
              </button>
            ) : null}
            <h2
              id="whatsapp-modal-title"
              className="text-lg font-bold tracking-tight text-slate-900 dark:text-white"
            >
              {modalCopy.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
              {modalCopy.subtitle}
            </p>
            {step !== "choose" ? (
              <p className="mt-2.5 text-xs text-slate-500 dark:text-zinc-500">
                <span aria-hidden>💬</span> WhatsApp: {ADAKARO_WHATSAPP_DISPLAY}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-95 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {step === "choose" ? (
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setErrors({});
                  setStep("demo");
                }}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <Calendar className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    Request a Demo
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                    Schedule a walkthrough of Adakaro for your school.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrors({});
                  setStep("support");
                }}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Headphones className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    Get Support
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                    Get help with your account or a technical issue.
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          {step === "demo" ? (
            <form
              id="wa-demo-form"
              onSubmit={(e) => void handleDemoSubmit(e)}
              className="space-y-5"
              noValidate
            >
              <Field
                id="wa-demo-name"
                label="Full Name"
                required
                value={demoForm.fullName}
                error={errors.fullName}
                disabled={submitting}
                onChange={(v) => setDemoForm((f) => ({ ...f, fullName: v }))}
                placeholder="Your full name"
              />
              <Field
                id="wa-demo-school"
                label="School Name"
                required
                value={demoForm.schoolName}
                error={errors.schoolName}
                disabled={submitting}
                onChange={(v) => setDemoForm((f) => ({ ...f, schoolName: v }))}
                placeholder="Your school name"
              />
              <Field
                id="wa-demo-phone"
                label="Phone / WhatsApp Number"
                required
                type="tel"
                value={demoForm.phone}
                error={errors.phone}
                disabled={submitting}
                onChange={(v) => setDemoForm((f) => ({ ...f, phone: v }))}
                placeholder="+255 7XX XXX XXX"
              />
              <Field
                id="wa-demo-students"
                label="Number of Students"
                value={demoForm.studentCount}
                disabled={submitting}
                onChange={(v) => setDemoForm((f) => ({ ...f, studentCount: v }))}
                placeholder="e.g. 450"
                type="number"
              />
              <div>
                <label htmlFor="wa-demo-message" className={CONTACT_LABEL_CLASS}>
                  What would you like to see during the demo?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="wa-demo-message"
                  rows={5}
                  value={demoForm.message}
                  disabled={submitting}
                  onChange={(e) =>
                    setDemoForm((f) => ({ ...f, message: e.target.value }))
                  }
                  className={CONTACT_FIELD_TEXTAREA_CLASS}
                  placeholder={DEMO_MESSAGE_PLACEHOLDER}
                />
                {errors.message ? (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                    {errors.message}
                  </p>
                ) : null}
              </div>
            </form>
          ) : null}

          {step === "support" ? (
            <form
              id="wa-support-form"
              onSubmit={(e) => void handleSupportSubmit(e)}
              className="space-y-5"
              noValidate
            >
              <Field
                id="wa-support-name"
                label="Full Name"
                required
                value={supportForm.fullName}
                error={errors.fullName}
                disabled={submitting}
                onChange={(v) => setSupportForm((f) => ({ ...f, fullName: v }))}
                placeholder="Your full name"
              />
              <Field
                id="wa-support-school"
                label="School Name"
                required
                value={supportForm.schoolName}
                error={errors.schoolName}
                disabled={submitting}
                onChange={(v) => setSupportForm((f) => ({ ...f, schoolName: v }))}
                placeholder="Your school name"
              />
              <Field
                id="wa-support-phone"
                label="Phone / WhatsApp Number"
                required
                type="tel"
                value={supportForm.phone}
                error={errors.phone}
                disabled={submitting}
                onChange={(v) => setSupportForm((f) => ({ ...f, phone: v }))}
                placeholder="+255 7XX XXX XXX"
              />
              <div>
                <label htmlFor="wa-support-issue" className={CONTACT_LABEL_CLASS}>
                  Support Issue <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="wa-support-issue"
                  rows={5}
                  value={supportForm.issue}
                  disabled={submitting}
                  onChange={(e) =>
                    setSupportForm((f) => ({ ...f, issue: e.target.value }))
                  }
                  className={CONTACT_FIELD_TEXTAREA_CLASS}
                  placeholder={SUPPORT_ISSUE_PLACEHOLDER}
                />
                {errors.issue ? (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                    {errors.issue}
                  </p>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>

        {/* Footer — always visible for actions */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-4 dark:border-zinc-800">
          {step === "choose" ? (
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.99] dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          ) : (
            <ModalActions
              formId={step === "demo" ? "wa-demo-form" : "wa-support-form"}
              onCancel={handleClose}
              loading={submitting}
              saveWarning={saveWarning}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  error,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={CONTACT_LABEL_CLASS}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(CONTACT_FIELD_CLASS, disabled && "opacity-60")}
        placeholder={placeholder}
        min={type === "number" ? 0 : undefined}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

function ModalActions({
  formId,
  onCancel,
  loading,
  saveWarning,
}: {
  formId: string;
  onCancel: () => void;
  loading: boolean;
  saveWarning?: boolean;
}) {
  return (
    <div className="space-y-3">
      {saveWarning ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          WhatsApp will open, but this request could not be saved in the
          dashboard.
        </p>
      ) : null}
      <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-zinc-500">
        We only use this information to respond to your request.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="submit"
          form={formId}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {loading ? "Opening WhatsApp…" : "Continue on WhatsApp"}
        </button>
      </div>
    </div>
  );
}
