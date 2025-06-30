/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs', 'net', 'tls', etc. modules on the client
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        dns: false,
        stream: false,
        path: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
        querystring: false,
        buffer: false,
        url: false,
        util: false,
      };
    }
    return config;
  },
  // Ensure server-side database operations don't leak to client
  serverExternalPackages: ['postgres'],
};

module.exports = nextConfig;
