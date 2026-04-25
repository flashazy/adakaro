import type { Metadata } from "next";
import Link from "next/link";
import { LegalTocNav } from "@/components/legal/legal-toc-nav";
import {
  LandingScrollBehavior,
  SmartFloatingScrollButton,
} from "@/components/landing/landing-scroll";

const PRIVACY_SECTION_IDS = [
  "privacy-hero",
  "information-we-collect",
  "how-we-use-information",
  "data-access-and-control",
  "data-storage-and-security",
  "payments",
  "third-party-services",
  "your-rights",
  "updates-to-this-policy",
  "contact",
] as const;

const privacyToc = [
  { id: "information-we-collect", label: "1. Information We Collect" },
  { id: "how-we-use-information", label: "2. How We Use Information" },
  { id: "data-access-and-control", label: "3. Data Access and Control" },
  { id: "data-storage-and-security", label: "4. Data Storage and Security" },
  { id: "payments", label: "5. Payments" },
  { id: "third-party-services", label: "6. Third-Party Services" },
  { id: "your-rights", label: "7. Your Rights" },
  { id: "updates-to-this-policy", label: "8. Updates to This Policy" },
  { id: "contact", label: "9. Contact" },
] as const;

export const metadata: Metadata = {
  title: "Privacy Policy — Adakaro",
  description:
    "How Adakaro collects, uses, stores, and protects information for schools using the platform.",
};

const body = "leading-relaxed text-gray-700 dark:text-gray-300";
const list = "mt-3 list-disc space-y-2 pl-5";
const sectionFirst = "scroll-mt-24 pt-0";
const sectionRest =
  "scroll-mt-24 border-t border-gray-200 pt-10 dark:border-zinc-800";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      <LandingScrollBehavior />

      <section
        id="privacy-hero"
        className="border-b border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900/30"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 mt-16">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Privacy Policy
            </h1>
            <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
              Last updated: April 25, 2026
            </span>
            <div
              className={`mt-4 max-w-2xl space-y-3 text-base leading-relaxed text-gray-600 dark:text-zinc-400`}
            >
              <p className={body}>
                Adakaro (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;)
                provides a school management platform that helps schools manage fees,
                students, reports, and communication in one system.
              </p>
              <p className={body}>
                This Privacy Policy explains how we collect, use, and protect your
                information when you use Adakaro.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-12 pb-16 pt-10 md:pt-12">
          <div className="mx-auto min-w-0 w-full max-w-3xl flex-1">
            <div className="space-y-0 text-base">
              <div id="information-we-collect" className={sectionFirst}>
                <section aria-labelledby="information-we-collect-heading">
                  <h2
                    id="information-we-collect-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    1. Information We Collect
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>We may collect the following information:</p>
                    <ul className={`${list} ${body}`}>
                      <li>Account information (name, email address, school name)</li>
                      <li>School data (student records, fee information, reports)</li>
                      <li>Messages submitted through contact forms</li>
                      <li>Basic technical information (such as browser type)</li>
                    </ul>
                    <p>
                      We only collect information necessary to operate the platform
                      effectively.
                    </p>
                  </div>
                </section>
              </div>

              <div id="how-we-use-information" className={sectionRest}>
                <section aria-labelledby="how-we-use-information-heading">
                  <h2
                    id="how-we-use-information-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    2. How We Use Information
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>We use your information to:</p>
                    <ul className={`${list} ${body}`}>
                      <li>Provide and operate the Adakaro platform</li>
                      <li>Manage school data and user access</li>
                      <li>Respond to support requests and inquiries</li>
                      <li>Improve system performance and usability</li>
                    </ul>
                    <p>We do not sell, rent, or trade your data to third parties.</p>
                  </div>
                </section>
              </div>

              <div id="data-access-and-control" className={sectionRest}>
                <section aria-labelledby="data-access-and-control-heading">
                  <h2
                    id="data-access-and-control-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    3. Data Access and Control
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>Each school controls its own data.</p>
                    <ul className={`${list} ${body}`}>
                      <li>School administrators manage access permissions</li>
                      <li>
                        Teachers, accountants, and parents only see information
                        relevant to their roles
                      </li>
                    </ul>
                  </div>
                </section>
              </div>

              <div id="data-storage-and-security" className={sectionRest}>
                <section aria-labelledby="data-storage-and-security-heading">
                  <h2
                    id="data-storage-and-security-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    4. Data Storage and Security
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>We take reasonable steps to protect your data:</p>
                    <ul className={`${list} ${body}`}>
                      <li>Data is stored using secure cloud infrastructure</li>
                      <li>
                        Access is controlled through authentication and permissions
                      </li>
                      <li>We work to prevent unauthorized access or misuse</li>
                    </ul>
                  </div>
                </section>
              </div>

              <div id="payments" className={sectionRest}>
                <section aria-labelledby="payments-heading">
                  <h2
                    id="payments-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    5. Payments
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>Adakaro currently supports manual payment tracking:</p>
                    <ul className={`${list} ${body}`}>
                      <li>Payments are recorded based on submitted receipts</li>
                      <li>Adakaro does not process payments directly at this time</li>
                    </ul>
                  </div>
                </section>
              </div>

              <div id="third-party-services" className={sectionRest}>
                <section aria-labelledby="third-party-services-heading">
                  <h2
                    id="third-party-services-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    6. Third-Party Services
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>
                      We may use trusted third-party providers (such as hosting
                      services) to operate the platform.
                    </p>
                    <p>These services are used only to support system functionality.</p>
                  </div>
                </section>
              </div>

              <div id="your-rights" className={sectionRest}>
                <section aria-labelledby="your-rights-heading">
                  <h2
                    id="your-rights-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    7. Your Rights
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>Schools may:</p>
                    <ul className={`${list} ${body}`}>
                      <li>Request updates or corrections to their data</li>
                      <li>Request deletion of their data</li>
                      <li>Control user access within their system</li>
                    </ul>
                  </div>
                </section>
              </div>

              <div id="updates-to-this-policy" className={sectionRest}>
                <section aria-labelledby="updates-to-this-policy-heading">
                  <h2
                    id="updates-to-this-policy-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    8. Updates to This Policy
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>We may update this Privacy Policy as Adakaro evolves.</p>
                    <p>Updates will be posted on this page.</p>
                  </div>
                </section>
              </div>

              <div id="contact" className={sectionRest}>
                <section aria-labelledby="contact-heading">
                  <h2
                    id="contact-heading"
                    className="text-xl font-semibold text-gray-900 dark:text-white"
                  >
                    9. Contact
                  </h2>
                  <div className={`mt-4 space-y-3 ${body}`}>
                    <p>If you have questions about this Privacy Policy, contact us:</p>
                    <p>
                      <a
                        href="mailto:support@adakaro.com"
                        className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 transition hover:decoration-gray-900 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-zinc-300"
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
                className="mt-4 inline-block text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 transition hover:decoration-gray-900 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-zinc-300"
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
                className="transition hover:text-gray-900 hover:underline dark:hover:text-zinc-100"
              >
                ← Back to home
              </Link>
              <span className="text-gray-300 dark:text-zinc-600" aria-hidden>
                ·
              </span>
              <Link
                href="/terms"
                className="transition hover:text-gray-900 hover:underline dark:hover:text-zinc-100"
              >
                Terms of Service
              </Link>
              <span className="text-gray-300 dark:text-zinc-600" aria-hidden>
                ·
              </span>
              <Link
                href="/faq"
                className="transition hover:text-gray-900 hover:underline dark:hover:text-zinc-100"
              >
                FAQ
              </Link>
            </nav>
          </div>

          <aside className="hidden w-56 shrink-0 lg:block">
            <LegalTocNav items={privacyToc} variant="privacy" />
          </aside>
        </div>
      </div>

      <SmartFloatingScrollButton sectionIds={PRIVACY_SECTION_IDS} />
    </div>
  );
}
