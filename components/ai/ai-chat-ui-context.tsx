"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface AIChatUIContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  navigateAndClose: (href: string) => void;
}

const AIChatUIContext = createContext<AIChatUIContextValue | null>(null);

function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function AIChatUIProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const navigateAndClose = useCallback(
    (href: string) => {
      setIsOpen(false);
      const navigate = () => {
        if (isExternalHref(href)) {
          window.location.assign(href);
          return;
        }
        router.push(href);
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(navigate);
      });
    },
    [router]
  );

  const value = useMemo(
    () => ({ isOpen, open, close, navigateAndClose }),
    [isOpen, open, close, navigateAndClose]
  );

  return (
    <AIChatUIContext.Provider value={value}>{children}</AIChatUIContext.Provider>
  );
}

export function useAIChatUI(): AIChatUIContextValue | null {
  return useContext(AIChatUIContext);
}

export function useAIChatUIOpen(): boolean {
  return useContext(AIChatUIContext)?.isOpen ?? false;
}

export function useAIChatNavigate():
  | ((href: string) => void)
  | null {
  return useContext(AIChatUIContext)?.navigateAndClose ?? null;
}
