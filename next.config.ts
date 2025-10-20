import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Disable ESLint during production builds on Vercel to avoid blocking deploys
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Avoid using Lightning CSS native pipeline for minification/optimizations
    // in environments where native binaries may not be available.
    optimizeCss: false,
  },
};

export default nextConfig;
