import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, '..'), // Points to Funds4funds/
  },
};

export default nextConfig;
