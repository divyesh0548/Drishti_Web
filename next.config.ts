import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx"],
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
