import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local-network preview from the developer's phone while Next.js is
  // running on the Mac. The .local hostname is stable even when Wi-Fi changes
  // the Mac's numeric IP address.
  allowedDevOrigins: [
    "10.100.171.201",
    "10.100.140.184",
    "Jamesons-MacBook-Air-282.local",
    "*.local",
  ],
};

export default nextConfig;
