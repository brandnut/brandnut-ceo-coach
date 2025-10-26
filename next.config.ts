import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Explicitly set monorepo root to avoid lockfile root confusion
  outputFileTracingRoot: path.join(__dirname, ".."),
  eslint: {
    // Keep ESLint enabled during build; set to true to skip if needed
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
