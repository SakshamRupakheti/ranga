import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.RANGA_BACKEND_URL ?? "http://127.0.0.1:3003"}/api/:path*`,
      },
    ];
  },
};
export default config;
