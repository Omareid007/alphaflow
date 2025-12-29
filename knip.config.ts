import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'server/index.ts',
    'app/**/*.{ts,tsx}',
    'scripts/*.ts',
  ],
  project: [
    'server/**/*.ts',
    'lib/**/*.{ts,tsx}',
    'components/**/*.tsx',
    'app/**/*.{ts,tsx}',
    'scripts/**/*.ts',
    'shared/**/*.ts',
  ],
  ignore: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/server_dist/**',
    '**/.next/**',
    '**/scripts/shared/**',  // Shared modules are used dynamically
  ],
  ignoreDependencies: [
    // Used in config files or runtime
    'dotenv',
    'tsx',
    'drizzle-kit',
    '@types/node',
    '@types/express',
    // Framework dependencies
    'next',
    'react',
    'react-dom',
    '@radix-ui/*',
    'tailwindcss',
    'postcss',
    'autoprefixer',
  ],
  // Next.js specific
  next: {
    entry: ['app/**/page.tsx', 'app/**/layout.tsx', 'app/**/route.ts'],
  },
};

export default config;
