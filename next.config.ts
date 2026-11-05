import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 루트 레이아웃이 여러 개([locale], admin)라서 공통 404는 app/global-not-found.tsx로 처리
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
