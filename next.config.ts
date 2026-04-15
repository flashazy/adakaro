import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Unique per deployment so build metadata and prefetch keys align with the
   * deployed revision. Client bundles already use content hashes in filenames
   * (Turbopack/webpack production output under `/_next/static/chunks/`).
   */
  generateBuildId: async () =>
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.CI_COMMIT_SHA ??
    `local-${Date.now()}`,

  experimental: {
    serverActions: {
      /** Must be ≥ max upload size (see `MAX_DOCUMENT_BYTES` in documents/constants.ts). */
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
