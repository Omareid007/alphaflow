const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Add support for additional file extensions
config.resolver = {
  ...config.resolver,
  assetExts: [
    ...config.resolver.assetExts,
    "db",
    "mp3",
    "ttf",
    "obj",
    "png",
    "jpg",
  ],
  sourceExts: [
    ...config.resolver.sourceExts,
    "js",
    "jsx",
    "json",
    "ts",
    "tsx",
    "cjs",
    "mjs",
  ],
  // Enable symlinks for monorepo support
  resolveRequest: null,
};

// Configure transformer options
// Note: react-native-svg-transformer is optional - only use if installed
let babelTransformerPath;
try {
  babelTransformerPath = require.resolve("react-native-svg-transformer");
  // If SVG transformer is available, exclude SVG from asset extensions
  config.resolver.assetExts = config.resolver.assetExts.filter(
    (ext) => ext !== "svg"
  );
  config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];
} catch (e) {
  // SVG transformer not installed, use default
  console.log(
    "react-native-svg-transformer not found, using default transformer"
  );
}

config.transformer = {
  ...config.transformer,
  ...(babelTransformerPath && { babelTransformerPath }),
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Add API proxy middleware
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url.startsWith("/api/")) {
        const http = require("http");
        const url = require("url");

        const parsedUrl = url.parse(req.url);
        const options = {
          hostname: "localhost",
          port: 5000,
          path: parsedUrl.path,
          method: req.method,
          headers: {
            ...req.headers,
            host: "localhost:5000",
          },
        };

        const proxyReq = http.request(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });

        proxyReq.on("error", (err) => {
          console.error("Proxy error:", err);
          res.writeHead(502);
          res.end("Proxy error");
        });

        req.pipe(proxyReq);
        return;
      }

      return middleware(req, res, next);
    };
  },
};

// Watch all relevant directories
config.watchFolders = [
  path.resolve(__dirname, "client"),
  path.resolve(__dirname, "shared"),
  path.resolve(__dirname, "node_modules"),
];

module.exports = config;
