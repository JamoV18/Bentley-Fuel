import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the local-network address used to preview Bentley Fuel on a phone
  // while the Next.js development server is running on the Mac.
  allowedDevOrigins: ["10.100.171.201"],
};

export default nextConfig;
