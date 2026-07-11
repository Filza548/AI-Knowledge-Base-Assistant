import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth"],
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
