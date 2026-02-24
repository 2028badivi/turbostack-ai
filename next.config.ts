import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/turbostack-ai',
  assetPrefix: '/turbostack-ai/',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
