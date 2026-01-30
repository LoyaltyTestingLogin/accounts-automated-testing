/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // API Proxy für Backend
  async rewrites() {
    const apiHost = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
    const apiPort = process.env.API_PORT || 4000;
    
    return [
      {
        source: '/api/:path*',
        destination: `http://${apiHost}:${apiPort}/api/:path*`,
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
