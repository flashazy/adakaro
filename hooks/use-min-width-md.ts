"use client";

import { useEffect, useState } from "react";

const MD_MIN = 768;

/** Matches Tailwind `md:` (min-width 768px). Defaults to false for SSR. */
export function useMinWidthMd(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_MIN}px)`);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return matches;
}
