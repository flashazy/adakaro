"use client";

import { ArrowUp, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/** Order matches landing page sections top-to-bottom */
const LANDING_SECTION_IDS = [
  "hero",
  "pain",
  "features",
  "how",
  "stories",
  "trust",
  "cta",
] as const;

const NEAR_BOTTOM_PX = 140;
/** Pixels to scroll down per click when using step mode (no section IDs). */
const SCROLL_STEP_PX = 500;
/** Section is considered “active” when its top has crossed this line from the viewport top */
const SECTION_ACTIVE_OFFSET_PX = 120;

export function LandingScrollBehavior() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = prev;
    };
  }, []);
  return null;
}

interface HeroScrollDownProps {
  targetId: string;
}

export function HeroScrollDown({ targetId }: HeroScrollDownProps) {
  const scrollToNext = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex justify-center pb-4 pt-2 sm:pb-6">
      <button
        type="button"
        onClick={scrollToNext}
        className="rounded-full p-2 text-slate-500 transition hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-zinc-500 dark:hover:text-indigo-400"
        aria-label="Scroll to next section"
      >
        <ChevronDown
          className="h-6 w-6 animate-bounce motion-reduce:animate-none"
          aria-hidden
        />
      </button>
    </div>
  );
}

function getActiveSectionIndex(sectionIds: readonly string[]): number {
  let active = 0;
  for (let i = 0; i < sectionIds.length; i++) {
    const id = sectionIds[i];
    const el = document.getElementById(id);
    if (!el) continue;
    const top = el.getBoundingClientRect().top;
    if (top <= SECTION_ACTIVE_OFFSET_PX) {
      active = i;
    }
  }
  return active;
}

function isNearBottomOfPage(): boolean {
  const doc = document.documentElement;
  const scrollBottom = window.scrollY + window.innerHeight;
  return scrollBottom >= doc.scrollHeight - NEAR_BOTTOM_PX;
}

export interface SmartFloatingScrollButtonProps {
  /**
   * Section IDs in document order (e.g. landing). Omit to use the default landing list.
   * Pass `[]` for long pages without sections — scrolls down in steps, then to top near bottom.
   */
  sectionIds?: readonly string[];
}

export function SmartFloatingScrollButton({
  sectionIds: sectionIdsProp,
}: SmartFloatingScrollButtonProps = {}) {
  const sectionIds = sectionIdsProp ?? LANDING_SECTION_IDS;

  const [nearBottom, setNearBottom] = useState(false);
  const [scrollY, setScrollY] = useState(0);

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

  const showScrollUp = nearBottom;

  const handleClick = () => {
    if (showScrollUp) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (sectionIds.length === 0) {
      window.scrollBy({ top: SCROLL_STEP_PX, behavior: "smooth" });
      return;
    }
    const active = getActiveSectionIndex(sectionIds);
    const nextId = sectionIds[active + 1];
    const nextEl = nextId ? document.getElementById(nextId) : null;
    if (nextEl) {
      nextEl.scrollIntoView({ behavior: "smooth" });
      return;
    }
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  const topFadeOpacity = scrollY < 56 ? 0.85 + (scrollY / 56) * 0.15 : 1;

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ opacity: topFadeOpacity }}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg shadow-slate-900/10 transition-[opacity,transform] duration-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-black/30 dark:hover:bg-zinc-700"
      aria-label={
        showScrollUp
          ? "Scroll to top"
          : sectionIds.length === 0
            ? "Scroll down"
            : "Scroll to next section"
      }
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <ChevronDown
          className={`absolute h-5 w-5 transition-opacity duration-200 ${
            showScrollUp
              ? "pointer-events-none opacity-0"
              : "opacity-100"
          }`}
          aria-hidden
        />
        <ArrowUp
          className={`absolute h-5 w-5 transition-opacity duration-200 ${
            showScrollUp
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          aria-hidden
        />
      </span>
    </button>
  );
}
