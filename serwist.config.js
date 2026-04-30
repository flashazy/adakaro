// @ts-check
import { serwist } from "@serwist/next/config";

/**
 * Configurator-mode config. Runs as a separate build step
 * (`serwist build`) after `next build` so the service worker can precache
 * every prerendered route, including the `/offline` fallback page.
 *
 * Bundler-agnostic — works with Next.js 16's default Turbopack production
 * builds without any `--webpack` override.
 */
export default serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});
