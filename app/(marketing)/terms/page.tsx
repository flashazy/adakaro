import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Adakaro",
  description:
    "Terms governing use of the Adakaro school fee management platform.",
};

const sections = [
  {
    id: "acceptance",
    title: "1. Acceptance of terms",
    body: (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
          use of Adakaro, including our websites, applications, and related
          services (collectively, the &ldquo;Service&rdquo;). By creating an
          account, accessing, or using the Service, you agree to be bound by
          these Terms and our Privacy Policy.
        </p>
        <p className="mt-4">
          If you are using the Service on behalf of a school or other
          organisation, you represent that you have authority to bind that
          organisation, and &ldquo;you&rdquo; includes both you individually and
          the organisation.
        </p>
        <p className="mt-4">
          If you do not agree to these Terms, you must not use the Service.
        </p>
      </>
    ),
  },
  {
    id: "description",
    title: "2. Description of the service",
    body: (
      <>
        <p>
          Adakaro is a cloud-based platform that helps schools manage student
          fees, fee structures, payments, receipts, and related reporting, and
          helps parents view balances and make payments where enabled. Features
          may vary by plan, configuration, or region.
        </p>
        <p className="mt-4">
          We may modify, suspend, or discontinue parts of the Service with
          reasonable notice where practicable. We do not guarantee uninterrupted
          or error-free operation.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "3. User accounts and responsibilities",
    body: (
      <>
        <p>
          You must provide accurate registration information and keep your
          credentials confidential. You are responsible for all activity under
          your account.
        </p>
        <p className="mt-4 font-medium text-slate-800 dark:text-zinc-200">
          Schools (administrators)
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Maintain accurate student, class, and fee data and comply with
            applicable education and data-protection obligations.
          </li>
          <li>
            Approve parent–student link requests in line with school policy and
            obtain consents where required by law.
          </li>
          <li>
            Ensure that staff with access to the Service use it only for
            legitimate school business.
          </li>
        </ul>
        <p className="mt-4 font-medium text-slate-800 dark:text-zinc-200">
          Parents and guardians
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Use the Service only for fees and information relating to your
            linked children, as approved by the school.
          </li>
          <li>
            Notify the school and us promptly if you suspect unauthorised access
            to your account.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "payments",
    title: "4. Payment processing (ClickPesa)",
    body: (
      <>
        <p>
          Certain payments are processed through ClickPesa or other payment
          partners we integrate with. When you initiate a payment, you may be
          subject to ClickPesa&apos;s (or the relevant provider&apos;s) terms,
          fees, and privacy practices in addition to these Terms.
        </p>
        <p className="mt-4">
          Adakaro displays fee amounts and payment status based on information
          from your school and payment confirmations we receive. You are
          responsible for verifying amounts with your school if in doubt.
          Disputes regarding the underlying fee obligation should be resolved
          with the school; we may assist only by providing available transaction
          records.
        </p>
      </>
    ),
  },
  {
    id: "fees-billing",
    title: "5. Fees and billing for the platform",
    body: (
      <>
        <p>
          Access to Adakaro may be offered under a subscription, per-school
          agreement, or other commercial terms communicated to your organisation.
          Unless otherwise agreed in writing, school fees collected through the
          platform belong to the school; platform fees (if any) are separate
          and will be described in your order form or invoice.
        </p>
        <p className="mt-4">
          Taxes, if applicable, are your responsibility unless stated otherwise
          in writing.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "6. Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Use the Service for any unlawful purpose or in violation of these
            Terms.
          </li>
          <li>
            Attempt to gain unauthorised access to the Service, other
            accounts, or our systems (including probing, scanning, or testing
            vulnerabilities without permission).
          </li>
          <li>
            Upload malware, interfere with the Service, or impose unreasonable
            load on our infrastructure.
          </li>
          <li>
            Misrepresent your identity, affiliation, or authority, or use the
            Service to harass, abuse, or harm others.
          </li>
          <li>
            Scrape, data-mine, or extract data from the Service except through
            documented APIs or features we expressly permit.
          </li>
        </ul>
        <p className="mt-4">
          We may suspend or terminate access for conduct that we reasonably
          believe violates this section or creates risk for users or the
          Service.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "7. Intellectual property",
    body: (
      <p>
        The Service, including its software, branding, and documentation, is
        owned by Adakaro or its licensors. We grant you a limited,
        non-exclusive, non-transferable licence to use the Service during your
        subscription or authorised access period. You retain ownership of data
        you submit; you grant us a licence to host, process, and display that
        data as needed to provide the Service.
      </p>
    ),
  },
  {
    id: "disclaimer",
    title: "8. Disclaimer of warranties",
    body: (
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
        AVAILABLE&rdquo;, WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
        IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE FULLEST
        EXTENT PERMITTED BY LAW.
      </p>
    ),
  },
  {
    id: "liability",
    title: "9. Limitation of liability",
    body: (
      <>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NEITHER ADAKARO NOR
          ITS AFFILIATES, DIRECTORS, EMPLOYEES, OR SUPPLIERS SHALL BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS
          OPPORTUNITY, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE,
          EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p className="mt-4">
          OUR AGGREGATE LIABILITY FOR CLAIMS ARISING OUT OF OR RELATING TO THE
          SERVICE IN ANY TWELVE-MONTH PERIOD SHALL NOT EXCEED THE GREATER OF (A)
          THE AMOUNT YOU PAID US FOR THE SERVICE IN THAT PERIOD OR (B) ONE
          HUNDRED UNITED STATES DOLLARS (USD 100), EXCEPT WHERE LIABILITY CANNOT
          BE LIMITED UNDER MANDATORY LAW (SUCH AS DEATH OR PERSONAL INJURY
          CAUSED BY NEGLIGENCE WHERE APPLICABLE).
        </p>
        <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500">
          Some jurisdictions do not allow certain limitations; in those cases,
          our liability is limited to the fullest extent permitted by law.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "10. Indemnity",
    body: (
      <p>
        You will defend, indemnify, and hold harmless Adakaro and its affiliates
        from any claims, damages, losses, and expenses (including reasonable
        legal fees) arising from your use of the Service, your data, or your
        violation of these Terms, except to the extent caused by our wilful
        misconduct.
      </p>
    ),
  },
  {
    id: "termination",
    title: "11. Termination",
    body: (
      <>
        <p>
          You may stop using the Service at any time. We may suspend or
          terminate your access if you materially breach these Terms, if
          required by law, or if we cease offering the Service in your region,
          subject to any express notice period in a separate agreement.
        </p>
        <p className="mt-4">
          Upon termination, your right to use the Service ceases. Provisions
          that by nature should survive (including intellectual property,
          disclaimers, limitation of liability, indemnity, and governing law)
          will survive.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "12. Governing law and disputes",
    body: (
      <>
        <p>
          These Terms are governed by the laws of the{" "}
          <strong>United Republic of Tanzania</strong>, without regard to
          conflict-of-law principles, except that if you are a consumer
          resident in another East African country (including Kenya, Uganda, or
          Rwanda), mandatory consumer protection rules of your country may still
          apply to you and may not be waived.
        </p>
        <p className="mt-4">
          Parties agree to seek to resolve disputes in good faith. Subject to
          mandatory local rules, exclusive jurisdiction and venue for disputes
          shall be the courts of <strong>Dar es Salaam, Tanzania</strong>, unless
          we notify you of a different governing jurisdiction in a written
          agreement (for example, a school enterprise contract).
        </p>
        <p className="mt-4">
          Schools operating solely in another jurisdiction may request a
          governing-law amendment in their order form; until then, the above
          applies by default.
        </p>
      </>
    ),
  },
  {
    id: "general",
    title: "13. General",
    body: (
      <>
        <p>
          These Terms constitute the entire agreement between you and Adakaro
          regarding the Service and supersede prior oral or written
          understandings on the same subject. If any provision is held invalid,
          the remainder remains in effect. Our failure to enforce a provision is
          not a waiver.
        </p>
        <p className="mt-4">
          You may not assign these Terms without our consent; we may assign
          them in connection with a merger, acquisition, or sale of assets.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "14. Contact",
    body: (
      <p>
        Questions about these Terms:{" "}
        <a
          href="mailto:legal@adakaro.com"
          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          legal@adakaro.com
        </a>
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-zinc-950 sm:py-16">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Terms of Service
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
            href="/privacy"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Privacy Policy
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
