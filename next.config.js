/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude MT5 bridge directories from build (they're symlinks for local development only)
  webpack: (config, { isServer }) => {
    // Ignore mt5-commands and mt5-responses directories during build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        ...(config.watchOptions?.ignored || []),
        '**/mt5-commands/**',
        '**/mt5-responses/**',
      ],
    };
    return config;
  },
  // Exclude from static file serving
  publicRuntimeConfig: {},
  serverRuntimeConfig: {},
}

module.exports = nextConfig

