import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".expo", ".cache"],
    testTimeout: 30000,
    setupFiles: ["./tests/setup.ts", "./tests/setup-react.ts"],
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@shared": path.resolve(__dirname, "./shared"),
      server: path.resolve(__dirname, "./server"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "server/**/*.ts",
        "shared/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/node_modules/**",
        "server/index.ts",
        "server_dist/**",
      ],
    },
  },
});
