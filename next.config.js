/** @type {import('next').NextConfig} */
const nextConfig = {
  // TODO: Enable strict builds after fixing 246 TypeScript errors
  // Run `npx tsc --noEmit` to see current errors
  // Target: Set both to false once errors are resolved
  eslint: {
    ignoreDuringBuilds: true, // TODO: Set to false
  },
  typescript: {
    ignoreBuildErrors: true, // TODO: Set to false (246 errors as of 2025-12-26)
  },
  images: { unoptimized: true },
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

module.exports = nextConfig;
