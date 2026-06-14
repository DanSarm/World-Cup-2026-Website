import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Keep tracing scoped to this app (avoids wrong root when parent lockfiles exist).
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Reuse recent RSC payloads when switching tabs — feels instant on mobile.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
