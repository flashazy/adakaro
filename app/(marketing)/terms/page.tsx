import type { Metadata } from "next";
import Link from "next/link";
import { LegalTocNav } from "@/components/legal/legal-toc-nav";
import {
  LandingScrollBehavior,
  SmartFloatingScrollButton,
} from "@/components/landing/landing-scroll";

const TERMS_SECTION_IDS = [
  "terms-hero",
  "use-of-the-service",
  "accounts",
  "user-responsibilities",
  "data-ownership",
  "pricing-and-payments",
  "service-availability",
  "limitation-of-liability",
  "changes-to-the-service",
  "termination",
  "contact",
] as const;

const termsToc = [
  { id: "use-of-the-service", label: "1. Use of the Service" },
  { id: "accounts", label: "2. Accounts" },
  { id: "user-responsibilities", label: "3. User Responsibilities" },
  { id: "data-ownership", label: "4. Data Ownership" },
  { id: "pricing-and-payments", label: "5. Pricing and Payments" },
  { id: "service-availability", label: "6. Service Availability" },
  { id: "limitation-of-liability", label: "7. Limitation of Liability" },
  { id: "changes-to-the-service", label: "8. Changes to the Service" },
  { id: "termination", label: "9. Termination" },
  { id: "contact", label: "10. Contact" },
] as const;

export const metadata: Metadata = {
  title: "Terms of Service — Adakaro",
  description:
    "Terms governing use of the Adakaro school management platform for schools and users.",
};

const body = "leading-relaxed text-gray-700 dark:text-gray-300";
const list = "mt-3 list-disc space-y-2 pl-5";
const sectionFirst = "scroll-mt-24 pt-0";
const sectionRest =
  "scroll-mt-24 border-t border-gray-200 pt-10 dark:border-zinc-800";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      <LandingScrollBehavior />

      <section
        id="terms-hero"
        className="border-b border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900/30"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 mt-16">
            <h1 className="text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
              Terms of Service
            </h1>
            <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
              Last updated: April 25, 2026
            </span>
            <p
              className={`mt-4 max-w-2xl text-base text-gray-600 dark:text-zinc-400 ${body}`}
            >
              By using Adakaro, you agree to these Terms of Service.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-12 pb-16 pt-10 md:pt-12">
          <div className="mx-auto min-w-0 w-full max-w-3xl flex-1">
            <div className="space-y-0 text-base">
              <div id="use-of-the-service" className={sectionFirst}>
                <section aria-labelledby="use-of-the-service-heading">
                  <h2
                    id="use-of-the-service-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    1. Use of the Service
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>
                      Adakaro provides tools for schools to manage fees, students,
                      reports, and related operations.
                    </p>
                    <p>
                      You agree to use the platform for legitimate school-related
                      purposes only.
                    </p>
                  </div>
                </section>
              </div>

              <div id="accounts" className={sectionRest}>
                <section aria-labelledby="accounts-heading">
                  <h2
                    id="accounts-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    2. Accounts
                  </h2>
                  <ul className={`${list} ${body}`}>
                    <li>Schools are responsible for their accounts and user access</li>
                    <li>Administrators manage permissions for staff and parents</li>
                    <li>Users must provide accurate and up-to-date information</li>
                  </ul>
                </section>
              </div>

              <div id="user-responsibilities" className={sectionRest}>
                <section aria-labelledby="user-responsibilities-heading">
                  <h2
                    id="user-responsibilities-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    3. User Responsibilities
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>You agree not to:</p>
                    <ul className={`${list} ${body}`}>
                      <li>Use the platform for unlawful activities</li>
                      <li>Attempt to access data without permission</li>
                      <li>Disrupt or misuse the system</li>
                    </ul>
                  </div>
                </section>
              </div>

              <div id="data-ownership" className={sectionRest}>
                <section aria-labelledby="data-ownership-heading">
                  <h2
                    id="data-ownership-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    4. Data Ownership
                  </h2>
                  <ul className={`${list} ${body}`}>
                    <li>Schools retain ownership of their data</li>
                    <li>Adakaro provides tools to manage and store that data</li>
                    <li>We do not claim ownership of school records</li>
                  </ul>
                </section>
              </div>

              <div id="pricing-and-payments" className={sectionRest}>
                <section aria-labelledby="pricing-and-payments-heading">
                  <h2
                    id="pricing-and-payments-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    5. Pricing and Payments
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <ul className={`${list} ${body}`}>
                      <li>Adakaro uses a per-student pricing model</li>
                      <li>Schools can start free with up to 20 students</li>
                      <li>Paid usage depends on the number of students</li>
                    </ul>
                    <p>Pricing may be updated in the future with notice.</p>
                  </div>
                </section>
              </div>

              <div id="service-availability" className={sectionRest}>
                <section aria-labelledby="service-availability-heading">
                  <h2
                    id="service-availability-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    6. Service Availability
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>We aim to keep Adakaro reliable and available.</p>
                    <p>
                      However, uninterrupted access is not guaranteed at all times.
                    </p>
                  </div>
                </section>
              </div>

              <div id="limitation-of-liability" className={sectionRest}>
                <section aria-labelledby="limitation-of-liability-heading">
                  <h2
                    id="limitation-of-liability-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    7. Limitation of Liability
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>Adakaro is provided &ldquo;as is&rdquo;.</p>
                    <p>We are not responsible for:</p>
                    <ul className={`${list} ${body}`}>
                      <li>Data loss caused by user actions</li>
                      <li>Incorrect data entered by users</li>
                      <li>External system or service interruptions</li>
                    </ul>
                  </div>
                </section>
              </div>

              <div id="changes-to-the-service" className={sectionRest}>
                <section aria-labelledby="changes-to-the-service-heading">
                  <h2
                    id="changes-to-the-service-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    8. Changes to the Service
                  </h2>
                  <p className={`mt-4 ${body}`}>
                    We may update or improve the platform over time.
                  </p>
                </section>
              </div>

              <div id="termination" className={sectionRest}>
                <section aria-labelledby="termination-heading">
                  <h2
                    id="termination-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    9. Termination
                  </h2>
                  <p className={`mt-4 ${body}`}>
                    We may suspend or terminate access if these terms are violated.
                  </p>
                </section>
              </div>

              <div id="contact" className={sectionRest}>
                <section aria-labelledby="contact-heading">
                  <h2
                    id="contact-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    10. Contact
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>For questions about these terms:</p>
                    <p>
                      <a
                        href="mailto:support@adakaro.com"
                        className="font-medium text-indigo-600 transition hover:underline dark:text-indigo-400"
                      >
                        support@adakaro.com
                      </a>
                    </p>
                  </div>
                </section>
              </div>
            </div>

            <div className="mt-16 text-center">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                Still have questions?
              </p>
              <p className={`mt-2 text-sm ${body}`}>
                If you have questions about this policy, contact us.
              </p>
              <Link
                href="/contact"
                className="mt-4 inline-block text-sm font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Contact us →
              </Link>
            </div>

            <nav
              className="mt-12 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-zinc-500"
              aria-label="Legal pages"
            >
              <Link
                href="/"
                className="transition hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
              >
                ← Back to home
              </Link>
              <span className="text-gray-300 dark:text-zinc-600" aria-hidden>
                ·
              </span>
              <Link
                href="/privacy"
                className="transition hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
              >
                Privacy Policy
              </Link>
              <span className="text-gray-300 dark:text-zinc-600" aria-hidden>
                ·
              </span>
              <Link
                href="/faq"
                className="transition hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
              >
                FAQ
              </Link>
            </nav>
          </div>

          <aside className="hidden w-56 shrink-0 lg:block">
            <LegalTocNav items={termsToc} variant="terms" />
          </aside>
        </div>
      </div>

      <SmartFloatingScrollButton sectionIds={TERMS_SECTION_IDS} />
    </div>
  );
}
