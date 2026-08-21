import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local-network addresses used to preview Bentley Fuel on a phone
  // while the Next.js development server is running on the Mac.
  allowedDevOrigins: ["10.100.171.201", "10.100.140.184"],
};

export default nextConfig;
