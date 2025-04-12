// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['monday.com', 'files.monday.com', 'cdn.monday.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.monday.com',
        port: '',
        pathname: '/**',
      },
    ],
    // Allow unoptimized external images when using the unoptimized prop
    unoptimized: true,
  },
  logging: {
    fetches: {
      fullUrl: true
    }
  }
};

module.exports = nextConfig;