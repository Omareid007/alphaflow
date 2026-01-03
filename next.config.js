const path = require("path");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for smaller production builds
  output: "standalone",

  // TypeScript and ESLint strict mode enabled
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },

  // Optimize package imports for better tree-shaking
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "framer-motion"],
  },

  // Webpack configuration for memory optimization
  webpack: (config, { dev }) => {
    // Enable filesystem cache for faster rebuilds (must be absolute path)
    config.cache = {
      type: "filesystem",
      cacheDirectory: path.join(__dirname, ".next/cache/webpack"),
    };

    // Reduce memory usage during development
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ["**/node_modules/**", "**/.git/**"],
      };
    }

    return config;
  },

  async rewrites() {
    // In production (Replit), backend and frontend are on same domain
    // In development, proxy API calls to Express server
    const apiTarget =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    console.log("[Next.js] API rewrites configured for:", apiTarget);

    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
  // Add headers for better CORS handling
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,OPTIONS,PATCH",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
