/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // API Proxy für Backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${process.env.API_PORT || 4000}/api/:path*`,
      },
      {
        source: '/test-results/:path*',
        destination: '/test-results/:path*',
      },
    ];
  },

  // Statische Artefakte
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;
