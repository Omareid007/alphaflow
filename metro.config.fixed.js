const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude SVG from default asset extensions (since we're using transformer)
config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...config.resolver.sourceExts, "svg", "cjs", "mjs"],
  resolveRequest: null,
};

// Configure SVG transformer
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
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
