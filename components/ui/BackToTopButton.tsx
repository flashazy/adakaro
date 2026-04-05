"use client";

import { ArrowUp } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const SCROLL_THRESHOLD_PX = 300;

function getScrollY(): number {
  if (typeof window === "undefined") return 0;
  return Math.max(
    window.scrollY ?? 0,
    window.pageYOffset ?? 0,
    document.documentElement?.scrollTop ?? 0,
    document.body?.scrollTop ?? 0,
  );
}

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const handleScroll = useCallback(() => {
    setVisible(getScrollY() > SCROLL_THRESHOLD_PX);
  }, []);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    handleScroll();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("scroll", handleScroll, opts);
    document.addEventListener("scroll", handleScroll, opts);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll);
    };
  }, [mounted, handleScroll]);

  useEffect(() => {
    if (!mounted) return;
    const onResize = () => handleScroll();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted, handleScroll]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => {
        const root = document.scrollingElement ?? document.documentElement;
        root.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={`fixed bottom-6 right-6 z-[9999] flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-[opacity,transform] duration-200 hover:scale-105 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-95 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <ArrowUp className="h-5 w-5" aria-hidden strokeWidth={2} />
    </button>,
    document.body,
  );
}
