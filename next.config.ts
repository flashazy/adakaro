import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Unique per deployment so build metadata and prefetch keys align with the
   * deployed revision. Client bundles already use content hashes in filenames
   * (Turbopack/webpack production output under `/_next/static/chunks/`).
   */
  generateBuildId: async () => {
    // In dev, a stable id keeps Server Action encryption keys aligned across
    // restarts; `local-${Date.now()}` changes every boot and breaks in-flight
    // POSTs / cached client chunks (Failed to find Server Action, Flight errors).
    // Chat polling uses GET /api/chat/* instead of Server Actions so polls stay
    // valid after restarts; keep this stable id for mutations (send, ensure, …).
    if (process.env.NODE_ENV === "development") {
      return "development";
    }
    return (
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GITHUB_SHA ??
      process.env.CI_COMMIT_SHA ??
      `local-${Date.now()}`
    );
  },

  experimental: {
    serverActions: {
      /** Must be ≥ max upload size (see `MAX_DOCUMENT_BYTES` in documents/constants.ts). */
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
