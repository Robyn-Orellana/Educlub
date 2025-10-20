import type { NextConfig } from "next";

// Set critical CSS build env vars as early as possible to avoid native binary
// issues in CI (Vercel) with Lightning CSS / Tailwind Oxide.
if (!process.env.TAILWIND_DISABLE_OXIDE) {
  process.env.TAILWIND_DISABLE_OXIDE = '1';
}
if (!process.env.LIGHTNINGCSS_USE_WASM) {
  process.env.LIGHTNINGCSS_USE_WASM = '1';
}
if (!process.env.LIGHTNINGCSS_IGNORE_NODE) {
  process.env.LIGHTNINGCSS_IGNORE_NODE = '1';
}

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Disable ESLint during production builds on Vercel to avoid blocking deploys
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
