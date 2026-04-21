"use client";

import { ArrowUp, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/** Distance from document bottom to treat as “at bottom” (show scroll-up). */
const NEAR_BOTTOM_PX = 160;

/** Pixels to scroll down per click when not at the bottom. */
const SCROLL_STEP_PX = 500;

function isNearBottomOfPage(): boolean {
  const doc = document.documentElement;
  const scrollBottom = window.scrollY + window.innerHeight;
  return scrollBottom >= doc.scrollHeight - NEAR_BOTTOM_PX;
}

/**
 * Fixed floating control (matches landing `SmartFloatingScrollButton` styling).
 * Scrolls down in steps; near the bottom, switches to scroll-to-top.
 */
export function FloatingScrollButton() {
  const [nearBottom, setNearBottom] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = prev;
    };
  }, []);

  const update = useCallback(() => {
    setScrollY(window.scrollY);
    setNearBottom(isNearBottomOfPage());
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const handleClick = () => {
    if (nearBottom) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.scrollBy({ top: SCROLL_STEP_PX, behavior: "smooth" });
  };

  const topFadeOpacity = scrollY < 56 ? 0.85 + (scrollY / 56) * 0.15 : 1;

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ opacity: topFadeOpacity }}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg shadow-slate-900/10 transition-[opacity,transform] duration-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-black/30 dark:hover:bg-zinc-700"
      aria-label={nearBottom ? "Scroll to top" : "Scroll down"}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <ChevronDown
          className={`absolute h-5 w-5 transition-opacity duration-200 ${
            nearBottom ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          aria-hidden
        />
        <ArrowUp
          className={`absolute h-5 w-5 transition-opacity duration-200 ${
            nearBottom ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden
        />
      </span>
    </button>
  );
}
