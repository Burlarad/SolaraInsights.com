const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin output file tracing to this directory to prevent workspace root inference issues
  outputFileTracingRoot: path.join(__dirname),

  images: {
    domains: [],
  },

  webpack: (config, { isServer }) => {
    // Force @ alias at webpack level for consistent resolution across all environments
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
    };

    // Externalize swisseph native addon on server builds so webpack doesn't try to bundle the .node binary
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("swisseph");
    }
    return config;
  },
}

module.exports = nextConfig
