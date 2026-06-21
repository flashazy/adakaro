export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { ContactsCenterClient } from "./contacts-center-client";

function ContactsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-slate-500 sm:px-6">
      Loading contacts…
    </div>
  );
}

export default function ContactsCenterPage() {
  return (
    <Suspense fallback={<ContactsLoading />}>
      <ContactsCenterClient />
    </Suspense>
  );
}
