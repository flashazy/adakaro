"use client";

import { useState } from "react";
import PayOnlineModal from "./pay-online-modal";

interface PayOnlineButtonProps {
  studentId: string;
  feeStructureId: string;
  feeName: string;
  amount: number;
}

export default function PayOnlineButton({
  studentId,
  feeStructureId,
  feeName,
  amount,
}: PayOnlineButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
        Pay online
      </button>
      {showModal && (
        <PayOnlineModal
          studentId={studentId}
          feeStructureId={feeStructureId}
          feeName={feeName}
          amount={amount}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
