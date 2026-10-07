import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep browser QA data isolated from the developer's localhost profile.
  allowedDevOrigins: ["127.0.0.1"],
  webpack(config, { isServer }) {
    // @vercel/functions re-exports its optional WebSocket support from the package
    // root. Falcon Fuel only uses Runtime Cache on the server, but webpack still
    // sees that optional `ws` peer while tracing shared modules for the browser.
    // `ws` is Node-only and is never used by the client, so explicitly stub it
    // only in browser bundles instead of forcing an unnecessary runtime package.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
      };
    }
    return config;
  },
};

export default nextConfig;
