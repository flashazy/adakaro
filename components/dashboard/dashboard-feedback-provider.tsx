"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { Toaster, toast } from "sonner";

type DashboardFeedbackContextValue = {
  startNavigation: () => void;
};

const DashboardFeedbackContext =
  createContext<DashboardFeedbackContextValue | null>(null);

export function useOptionalDashboardFeedback() {
  return useContext(DashboardFeedbackContext);
}

export function useDashboardFeedback() {
  const ctx = useContext(DashboardFeedbackContext);
  if (!ctx) {
    throw new Error(
      "useDashboardFeedback must be used within DashboardFeedbackProvider"
    );
  }
  return ctx;
}

/** Success toast: bottom-right, auto-dismiss 2s (Sonner default overridden per toast). */
export function showAdminSuccessToast(message: string) {
  toast.success(message, { duration: 2000 });
}

export function showAdminErrorToast(message: string) {
  toast.error(message, { duration: 6000 });
}

export function DashboardFeedbackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  const startNavigation = useCallback(() => {
    setNavigating(true);
  }, []);

  const value = useMemo(
    () => ({ startNavigation }),
    [startNavigation]
  );

  return (
    <DashboardFeedbackContext.Provider value={value}>
      {navigating ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[300] h-0.5 overflow-hidden bg-blue-600/10 dark:bg-blue-400/10"
          aria-hidden
        >
          <div className="dashboard-nav-indeterminate h-full w-1/3 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.45)] dark:bg-blue-500 dark:shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
        </div>
      ) : null}
      <Toaster
        position="bottom-right"
        richColors
        theme="system"
        closeButton
        toastOptions={{
          duration: 2000,
          classNames: {
            toast:
              "border shadow-lg backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95",
          },
        }}
      />
      {children}
    </DashboardFeedbackContext.Provider>
  );
}
