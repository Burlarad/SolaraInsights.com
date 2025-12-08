/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },

  webpack: (config, { isServer }) => {
    // Externalize swisseph native addon on server builds so webpack doesn't try to bundle the .node binary
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("swisseph");
    }
    return config;
  },
}

module.exports = nextConfig
