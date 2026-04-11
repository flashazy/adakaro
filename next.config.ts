import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /** Must be ≥ max upload size (see `MAX_DOCUMENT_BYTES` in documents/constants.ts). */
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
