import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Adakaro",
  description:
    "How Adakaro collects, uses, and protects personal data for school fee management.",
};

const sections = [
  {
    id: "intro",
    title: "1. Introduction",
    body: (
      <>
        <p>
          Adakaro (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;)
          provides a school fee management platform for educational institutions,
          parents, and guardians. We are committed to protecting your privacy and
          handling personal data responsibly, in line with practices appropriate
          for services operating in East Africa and internationally.
        </p>
        <p className="mt-4">
          This Privacy Policy explains what information we collect, how we use
          it, how we protect it, and your rights. By using Adakaro, you
          acknowledge that you have read this policy. If you do not agree,
          please discontinue use of the service.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "2. Information we collect",
    body: (
      <>
        <p className="font-medium text-slate-800 dark:text-zinc-200">
          Account and identity data
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Name, email address, phone number (where provided), and account
            credentials for school administrators and parents.
          </li>
          <li>
            Role information (e.g. admin or parent) and profile details stored
            in our systems.
          </li>
        </ul>
        <p className="mt-4 font-medium text-slate-800 dark:text-zinc-200">
          School and academic data
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            School name, settings, currency preferences, classes, fee types, fee
            structures, and related configuration.
          </li>
          <li>
            Student records required for fee management, such as names,
            admission numbers, class assignments, and links between parents and
            students where you or your school have established those
            relationships.
          </li>
        </ul>
        <p className="mt-4 font-medium text-slate-800 dark:text-zinc-200">
          Payment-related data
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Fee amounts, payment status, receipts, control numbers, transaction
            references, and metadata needed to reconcile payments with student
            accounts.
          </li>
          <li>
            We do not store full payment card details on Adakaro servers.
            Card or mobile-money payments are processed by our payment partner
            (ClickPesa) under their own terms and security standards; we may
            receive confirmation of successful or failed payments and limited
            identifiers to match transactions to your account.
          </li>
        </ul>
        <p className="mt-4 font-medium text-slate-800 dark:text-zinc-200">
          Technical and usage data
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            IP address, browser type, device information, and logs that help us
            secure the platform, diagnose errors, and improve reliability.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "3. How we use your information",
    body: (
      <>
        <p>We use personal data to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Provide, operate, and improve the Adakaro service, including fee
            balances, payment tracking, and reporting for schools.
          </li>
          <li>
            Facilitate parent–student linking, approvals, and communications
            necessary for account administration.
          </li>
          <li>
            Initiate and confirm payments through ClickPesa (e.g. control
            numbers, checkout links, webhooks) and update payment records in
            your school&apos;s workspace.
          </li>
          <li>
            Send service-related notices (e.g. security alerts, account
            updates) and, where permitted, operational messages about the
            platform.
          </li>
          <li>
            Comply with legal obligations, enforce our terms, and protect the
            rights, safety, and integrity of users and the service.
          </li>
        </ul>
        <p className="mt-4">
          We do not sell your personal information. We do not use student data
          for unrelated behavioural advertising.
        </p>
      </>
    ),
  },
  {
    id: "protection",
    title: "4. Data protection and security",
    body: (
      <>
        <p>
          We implement appropriate technical and organisational measures
          designed to protect personal data against unauthorised access,
          alteration, disclosure, or destruction. These include:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Encryption in transit (TLS/SSL) between your browser and our
            application.
          </li>
          <li>
            Access controls and authentication so that users generally see only
            the data their role and school relationship permit.
          </li>
          <li>
            Secure hosting and database infrastructure provided by our
            subprocessors (see below).
          </li>
        </ul>
        <p className="mt-4">
          No method of transmission over the Internet is completely secure. We
          encourage strong passwords and prompt reporting of suspected
          unauthorised access.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "5. Third-party services",
    body: (
      <>
        <p className="font-medium text-slate-800 dark:text-zinc-200">
          Supabase
        </p>
        <p className="mt-2">
          We use Supabase for authentication, database storage, and related
          infrastructure. Data you submit to Adakaro is processed and stored on
          systems operated by Supabase in accordance with their privacy policy
          and our configuration (including row-level security policies where
          applicable).
        </p>
        <p className="mt-4 font-medium text-slate-800 dark:text-zinc-200">
          ClickPesa
        </p>
        <p className="mt-2">
          Payment services (including mobile money and related rails) are
          provided by ClickPesa. When you pay through ClickPesa, their privacy
          notice and terms govern how they process payment data. We receive only
          the information needed to confirm payments and maintain fee records.
        </p>
        <p className="mt-4">
          We may use additional subprocessors (e.g. hosting, analytics) as our
          operations evolve. Material changes will be reflected in updates to
          this policy where required.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "6. Retention",
    body: (
      <p>
        We retain personal data for as long as your account is active, as needed
        to provide the service, and as required by law or legitimate business
        needs (such as financial record-keeping). Schools may request deletion
        or export of certain data subject to legal retention requirements.
      </p>
    ),
  },
  {
    id: "rights",
    title: "7. Your rights",
    body: (
      <>
        <p>
          Depending on your jurisdiction (including applicable data-protection
          laws in Kenya, Tanzania, Uganda, and elsewhere), you may have rights
          to:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate or incomplete data.</li>
          <li>
            Request deletion of your data, where legally permissible and not
            overridden by the school&apos;s legitimate interests or legal
            obligations.
          </li>
          <li>Object to or restrict certain processing, where applicable.</li>
          <li>Lodge a complaint with a supervisory authority, where available.</li>
        </ul>
        <p className="mt-4">
          Parents should note that some records are controlled by the school;
          we may need to coordinate requests with your school where appropriate.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "8. Children",
    body: (
      <p>
        Adakaro is used by schools to manage fees for students, who may be
        minors. We do not knowingly market directly to children. Personal data
        about students is provided by schools or parents for educational and fee
        purposes. Schools are responsible for obtaining any required consents
        under local law.
      </p>
    ),
  },
  {
    id: "changes",
    title: "9. Changes to this policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. We will post the
        revised version on this page and update the &ldquo;Last updated&rdquo;
        date. Continued use of Adakaro after changes constitutes acceptance of
        the updated policy, except where applicable law requires additional
        steps.
      </p>
    ),
  },
  {
    id: "contact",
    title: "10. Contact us",
    body: (
      <>
        <p>
          For privacy-related questions, requests to exercise your rights, or
          concerns about data handling, please contact us at:
        </p>
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200">
          <strong>Email:</strong>{" "}
          <a
            href="mailto:info@adakaro.com"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            info@adakaro.com
          </a>
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-zinc-950 sm:py-16">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          Last updated: 23 March 2026
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`}>
              <h2
                id={`${s.id}-heading`}
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {s.title}
              </h2>
              <div className="mt-3">{s.body}</div>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-slate-200 pt-8 dark:border-zinc-800">
          <Link
            href="/"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            ← Back to home
          </Link>
          {" · "}
          <Link
            href="/terms"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Terms of Service
          </Link>
          {" · "}
          <Link
            href="/faq"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            FAQ
          </Link>
        </p>
      </article>
    </div>
  );
}
