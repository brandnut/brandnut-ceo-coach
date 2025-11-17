import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure base path for /ceo sub-path deployment
  basePath: '/ceo',

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
