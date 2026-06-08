import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Keep tracing scoped to this app (avoids wrong root when parent lockfiles exist).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
