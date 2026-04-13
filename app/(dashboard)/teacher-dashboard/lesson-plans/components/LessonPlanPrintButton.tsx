"use client";

import { Printer } from "lucide-react";
import { useCallback } from "react";

export function LessonPlanPrintButton() {
  const handlePrint = useCallback(() => {
    const root = document.getElementById("lesson-plan-print-root");
    if (!root) return;

    document.getElementById("lesson-plan-print-styles")?.remove();

    const style = document.createElement("style");
    style.id = "lesson-plan-print-styles";
    style.textContent = `
      @media print {
        @page {
          margin: 18mm;
          size: A4 portrait;
        }
        html, body {
          background: #fff !important;
        }
        body * {
          visibility: hidden !important;
        }
        #lesson-plan-print-root,
        #lesson-plan-print-root * {
          visibility: visible !important;
        }
        #lesson-plan-print-root {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    const removeStyle = () => {
      style.remove();
    };

    const onAfterPrint = () => {
      removeStyle();
      window.removeEventListener("afterprint", onAfterPrint);
    };

    window.addEventListener("afterprint", onAfterPrint);
    window.print();
    window.setTimeout(() => {
      if (document.getElementById("lesson-plan-print-styles")) {
        removeStyle();
        window.removeEventListener("afterprint", onAfterPrint);
      }
    }, 2000);
  }, []);

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <Printer className="h-4 w-4 shrink-0" aria-hidden />
      Print
    </button>
  );
}
