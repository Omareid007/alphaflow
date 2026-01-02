const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript and ESLint strict mode enabled (all errors fixed 2025-12-27)
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  // Optimize package imports for better tree-shaking
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', 'framer-motion'],
  },
  async rewrites() {
    // In production (Replit), backend and frontend are on same domain
    // In development, proxy API calls to Express server
    const apiTarget = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    console.log('[Next.js] API rewrites configured for:', apiTarget);

    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
  // Add headers for better CORS handling
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS,PATCH' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
