import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdf-parse", "mammoth", "exceljs"],
};

export default nextConfig;
