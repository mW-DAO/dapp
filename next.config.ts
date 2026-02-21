import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "img.cmw.place",
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
    ],
  },
  webpack: (config) => {
    config.externals.push(
      "pino-pretty",
      "lokijs",
      "encoding",
      "@solana/kit",
      "@solana/web3.js",
      "axios"
    );
    return config;
  },
  turbopack: {},
};

export default nextConfig;
