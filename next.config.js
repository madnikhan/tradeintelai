/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/downloads/:path*',
        destination: '/subscribe',
        permanent: false,
      },
    ];
  },
  // Exclude MT5 bridge directories from build (they're symlinks for local development only)
  webpack: (config, { isServer }) => {
    // Ignore mt5-commands and mt5-responses directories during build
    if (!config.watchOptions) {
      config.watchOptions = {};
    }
    
    const existingIgnored = config.watchOptions.ignored;
    const ignoredPatterns = ['**/mt5-commands/**', '**/mt5-responses/**'];
    
    if (Array.isArray(existingIgnored)) {
      // Filter out any non-string values and add our patterns
      const validIgnored = existingIgnored.filter(item => typeof item === 'string');
      config.watchOptions.ignored = [...validIgnored, ...ignoredPatterns];
    } else if (typeof existingIgnored === 'string') {
      config.watchOptions.ignored = [existingIgnored, ...ignoredPatterns];
    } else {
      config.watchOptions.ignored = ignoredPatterns;
    }
    
    return config;
  },
}

module.exports = nextConfig

