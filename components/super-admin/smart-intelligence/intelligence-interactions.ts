const HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-indigo-400/70",
  "ring-offset-2",
  "transition-shadow",
  "duration-300",
] as const;

/**
 * Smooth-scroll to a Smart Intelligence section and briefly highlight it.
 */
export function scrollToIntelligenceSection(
  sectionId: string,
  options?: { highlight?: boolean; highlightMs?: number }
): boolean {
  const el = document.getElementById(sectionId);
  if (!el) return false;

  el.scrollIntoView({ behavior: "smooth", block: "start" });

  if (options?.highlight === false) return true;

  el.classList.add(...HIGHLIGHT_CLASSES);
  window.setTimeout(() => {
    el.classList.remove(...HIGHLIGHT_CLASSES);
  }, options?.highlightMs ?? 1500);

  return true;
}
