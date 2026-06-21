"use client";

/**
 * Dashboard-only mobile CSS tweaks (sticky header clearance + floating scroll offset).
 * Scoped via #sa-dashboard so other Super Admin pages are unaffected.
 */
export function SuperAdminDashboardMobilePolish() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @media (max-width: 767px) {
            html:has(#sa-dashboard) {
              scroll-padding-top: 4.75rem;
            }
            #sa-dashboard {
              padding-bottom: max(
                8.75rem,
                calc(6.75rem + env(safe-area-inset-bottom, 0px))
              );
            }
            #sa-dashboard [id^="sa-"] {
              scroll-margin-top: 4.75rem;
            }
            body:has(#sa-dashboard) button.fixed.bottom-6.right-6.z-50,
            body:has(#sa-dashboard) button.fixed.z-40 {
              bottom: max(
                6rem,
                calc(4.75rem + env(safe-area-inset-bottom, 0px))
              ) !important;
              right: 1rem !important;
              z-index: 40 !important;
              width: 2.75rem !important;
              height: 2.75rem !important;
              min-width: 2.75rem !important;
              min-height: 2.75rem !important;
              border-color: rgba(226, 232, 240, 0.85) !important;
              background: rgba(255, 255, 255, 0.82) !important;
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              box-shadow: 0 2px 10px rgba(15, 23, 42, 0.07) !important;
            }
            body:has(#sa-dashboard) button.fixed.bottom-6.right-6.z-50 svg,
            body:has(#sa-dashboard) button.fixed.z-40 svg {
              width: 1.125rem !important;
              height: 1.125rem !important;
            }
          }
        `,
      }}
    />
  );
}
