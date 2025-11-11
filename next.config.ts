import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || '';

const nextConfig: NextConfig = {
  // Base path for deployment (e.g., /ceo-coach-demo)
  basePath: basePath,

  // Asset prefix for static assets
  assetPrefix: basePath || undefined,

  // Use default tracing root (project dir) to avoid Vercel path duplication issues
  eslint: {
    // Keep ESLint enabled during build; set to true to skip if needed
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  // Enable standalone output for Docker
  output: 'standalone',
};

export default nextConfig;
