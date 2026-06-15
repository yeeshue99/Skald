import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tweets and avatars can carry an image payload through server actions.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
