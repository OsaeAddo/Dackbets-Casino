import type { NextConfig } from "next";

// Next 16 blocks dev-only resources (HMR, client chunks) for origins other than
// the one the dev server was started with. When that happens React never
// hydrates and forms fall back to native submission, so LAN testing needs an
// explicit allow-list. Configure it per machine in frontend/.env.local:
//   ALLOWED_DEV_ORIGINS=192.168.1.20,my-laptop.local
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
