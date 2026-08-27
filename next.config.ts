import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
