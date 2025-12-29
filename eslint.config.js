// https://docs.expo.dev/guides/using-eslint/
// ESLint 8 flat config format
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = [
  ...expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*"],
  },
  // Enforce structured logging in server code
  {
    files: ["server/**/*.ts"],
    rules: {
      "no-console": ["warn", {
        allow: [] // No exceptions - use structured logger instead
      }],
    },
  },
];
