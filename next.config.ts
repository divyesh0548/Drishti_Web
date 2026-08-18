import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx", "pdfkit", "fontkit", "@prisma/client", "@prisma/adapter-pg", "pg", "bcryptjs", "nodemailer"],
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
