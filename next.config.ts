import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Timesheet attachments are uploaded through server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
  serverExternalPackages: ["pdf-lib", "nodemailer", "bcryptjs"],
  devIndicators: false,
};

export default nextConfig;
