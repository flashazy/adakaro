"use client";

import { useEffect, useState } from "react";

/** True between `beforeprint` and `afterprint` so ranking can show the full list for print. */
export function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const onBefore = () => setPrinting(true);
    const onAfter = () => setPrinting(false);
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint", onAfter);
    };
  }, []);

  return printing;
}
