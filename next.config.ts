import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Dockerfile multi-stage standalone build
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
