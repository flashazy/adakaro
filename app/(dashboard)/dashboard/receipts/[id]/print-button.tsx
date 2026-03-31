"use client";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Prints from a minimal iframe document so the browser print footer often shows
 * a short document URL instead of the full app path. For no URL at all, users
 * can disable “Headers and footers” in the browser print dialog.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const receipt = document.querySelector<HTMLElement>(".receipt-print");
        if (!receipt) {
          window.print();
          return;
        }

        const iframe = document.createElement("iframe");
        iframe.setAttribute("aria-hidden", "true");
        Object.assign(iframe.style, {
          position: "fixed",
          right: "0",
          bottom: "0",
          width: "0",
          height: "0",
          border: "0",
          visibility: "hidden",
        });
        document.body.appendChild(iframe);

        const win = iframe.contentWindow;
        const doc = iframe.contentDocument;
        if (!win || !doc) {
          iframe.remove();
          window.print();
          return;
        }

        const htmlClass = document.documentElement.className;
        const title = document.title || "Payment Receipt";

        let headHtml = `<meta charset="utf-8"/><title>${escapeHtml(title)}</title>`;
        document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
          headHtml += el.outerHTML;
        });
        document.querySelectorAll("style").forEach((el) => {
          headHtml += el.outerHTML;
        });

        doc.open();
        doc.write(
          `<!DOCTYPE html><html lang="en" class="${escapeHtml(htmlClass)}"><head>${headHtml}</head><body style="margin:0;background:#fff">`
        );
        doc.write(receipt.outerHTML);
        doc.write("</body></html>");
        doc.close();

        const cleanup = () => {
          iframe.remove();
        };

        const failSafe = setTimeout(cleanup, 60_000);

        win.addEventListener(
          "afterprint",
          () => {
            clearTimeout(failSafe);
            cleanup();
          },
          { once: true }
        );

        let printed = false;
        const runPrint = () => {
          if (printed) return;
          printed = true;
          try {
            win.focus();
            win.print();
          } catch {
            clearTimeout(failSafe);
            cleanup();
          }
        };

        const links = doc.querySelectorAll('link[rel="stylesheet"]');
        if (links.length === 0) {
          setTimeout(runPrint, 150);
          return;
        }

        let pending = links.length;
        links.forEach((link) => {
          const done = () => {
            pending -= 1;
            if (pending === 0) {
              setTimeout(runPrint, 150);
            }
          };
          link.addEventListener("load", done);
          link.addEventListener("error", done);
        });

        setTimeout(() => {
          if (!printed) {
            runPrint();
          }
        }, 1200);
      }}
      className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      Print receipt
    </button>
  );
}
