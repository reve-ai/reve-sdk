import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting is run explicitly via `npm run lint`; don't block builds on it
    // for this demo so contributors can iterate without a strict CI-only gate.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
