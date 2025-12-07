const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

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

module.exports = config;
