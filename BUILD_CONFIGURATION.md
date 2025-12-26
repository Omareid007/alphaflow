# Build Configuration Guide

This document explains the Expo/React Native build configuration for the AlphaFlow Trading Platform.

## Project Structure

This is a **hybrid monorepo** containing:
- **Next.js Web App** (`/app` directory) - Web interface using Next.js 13+ App Router
- **React Native Mobile App** (`/client` directory) - Native mobile app using Expo
- **Shared Backend** (`/server` directory) - Express server serving both platforms
- **Shared Code** (`/shared` directory) - Common types and utilities

## Configuration Files

### 1. babel.config.js
Configures Babel transpilation for React Native/Expo:
- Uses `babel-preset-expo` for Expo-specific transforms
- Includes `module-resolver` for path aliases (@, @shared, @server)
- Includes `react-native-reanimated/plugin` (must be last)

### 2. metro.config.js
Configures Metro bundler (React Native's JavaScript bundler):
- **Resolver**: Handles file extensions and module resolution
  - Asset extensions: db, mp3, ttf, obj, png, jpg
  - Source extensions: js, jsx, json, ts, tsx, cjs, mjs
- **Transformer**: Uses `react-native-svg-transformer` for SVG support
- **Server Middleware**: Proxies /api/* requests to Express server on port 5000
- **Watch Folders**: Monitors client/, shared/, and node_modules/

### 3. app.json
Expo configuration manifest:
- **Entry Point**: `client/index.js` (where the app starts)
- **Platforms**: iOS, Android, Web
- **New Architecture**: Enabled for better performance
- **Plugins**: Splash screen, web browser
- **Platform-specific settings**: Bundle IDs, permissions, icons

### 4. tsconfig.json
TypeScript configuration:
- **Target**: esnext for modern JavaScript features
- **JSX**: react-jsx for React 18+ automatic runtime
- **Module Resolution**: bundler mode for both Next.js and Metro
- **Path Aliases**:
  - `@/*` → `./client/*`
  - `@shared/*` → `./shared/*`
  - `@server/*` → `./server/*`

### 5. .eslintrc.json
ESLint configuration for both platforms:
- Extends: next/core-web-vitals, expo, prettier
- Rules configured for TypeScript, React, and React Native

### 6. .prettierrc
Prettier code formatting rules:
- 2 spaces, semicolons, double quotes
- 80 character line width
- Consistent formatting across all files

### 7. global.d.ts
TypeScript global type declarations:
- Image import types (png, jpg, svg)
- Environment variable types
- React Navigation types

## Package.json Scripts

### Development
```bash
npm run dev              # Start both Next.js and Express server
npm run dev:client       # Start Next.js web app (port 3000)
npm run dev:mobile       # Start Expo dev server for mobile
npm run dev:server       # Start Express API server (port 5000)
```

### Mobile Development
```bash
npm run start:mobile     # Start Expo Metro bundler
npm run android          # Build and run Android app
npm run ios              # Build and run iOS app (macOS only)
npm run web:expo         # Run Expo web version
```

### Production
```bash
npm run build            # Build Next.js and server
npm run start            # Start production servers
```

### Utilities
```bash
npm run prebuild         # Generate native iOS/Android projects
npm run prebuild:clean   # Clean and regenerate native projects
npm run typecheck        # Run TypeScript type checking
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

## Key Dependencies

### Core Expo/React Native
- `expo` (^54.0.25) - Expo SDK
- `react-native` (^0.81.5) - React Native framework
- `react-native-web` (^0.21.2) - Web compatibility layer

### Navigation
- `@react-navigation/native` - Navigation library
- `@react-navigation/native-stack` - Stack navigator
- `@react-navigation/bottom-tabs` - Tab navigator

### UI Components
- `react-native-gesture-handler` - Touch gestures
- `react-native-reanimated` - Animations
- `react-native-safe-area-context` - Safe area handling
- `react-native-screens` - Native screen optimization
- `react-native-svg` - SVG support

### Expo Modules
- `expo-blur` - Blur effects
- `expo-constants` - App constants
- `expo-font` - Custom fonts
- `expo-haptics` - Haptic feedback
- `expo-linking` - Deep linking
- `expo-splash-screen` - Splash screen
- `expo-status-bar` - Status bar control
- `expo-web-browser` - In-app browser

### Build Tools
- `@babel/core` - Babel transpiler
- `babel-preset-expo` - Expo Babel preset
- `babel-plugin-module-resolver` - Path alias resolution
- `react-native-svg-transformer` - SVG transformer
- `eslint-config-expo` - Expo ESLint rules

## Common Build Issues & Fixes

### 1. Transform Errors
**Error**: "Unable to resolve module"
**Fix**:
- Clear Metro cache: `npx expo start -c`
- Check path aliases in babel.config.js and tsconfig.json
- Ensure file extensions are included in metro.config.js

### 2. Module Not Found
**Error**: "Module not found: Can't resolve '@/...'"
**Fix**:
- Verify babel-plugin-module-resolver is installed
- Check babel.config.js alias configuration
- Restart Metro bundler

### 3. TypeScript Errors
**Error**: "Cannot find module" or "Type 'X' is not assignable"
**Fix**:
- Run `npm run typecheck` to identify issues
- Check tsconfig.json paths configuration
- Ensure global.d.ts is in project root

### 4. SVG Import Errors
**Error**: "Error: Invalid call at line X: require(...)"
**Fix**:
- Ensure react-native-svg-transformer is installed
- Check metro.config.js transformer configuration
- Import SVG as: `import Logo from './logo.svg'`

### 5. Asset Loading Issues
**Error**: "Unable to resolve asset"
**Fix**:
- Check file path is relative or absolute
- Verify asset extension in metro.config.js assetExts
- Use require() for dynamic assets: `require('./image.png')`

### 6. API Connection Issues
**Error**: "Network request failed"
**Fix**:
- Ensure Express server is running (port 5000)
- Check metro.config.js proxy configuration
- For physical devices, use your computer's IP instead of localhost

### 7. Reanimated Plugin Errors
**Error**: "Reanimated 2 failed to create a worklet"
**Fix**:
- Ensure react-native-reanimated/plugin is LAST in babel.config.js
- Clear cache: `npx expo start -c`
- Restart Metro bundler

### 8. Dependency Conflicts
**Error**: "Invariant Violation: requireNativeComponent"
**Fix**:
- Install missing native dependencies: `npm install`
- Run prebuild: `npm run prebuild:clean`
- For Expo Go, ensure all packages are compatible

## Architecture Notes

### Dual Platform Support
- **Web**: Next.js handles routing, SSR, and web-specific features
- **Mobile**: Expo/React Native handles native features and navigation
- **Shared**: Both platforms share the same backend API and business logic

### API Communication
- Metro dev server proxies /api/* to Express (port 5000)
- Next.js uses built-in API routes rewrites
- Mobile apps can connect directly to backend via EXPO_PUBLIC_API_URL

### Code Sharing Strategy
- **client/**: React Native components (mobile-only)
- **app/**: Next.js pages (web-only)
- **components/**: Some components may work on both with react-native-web
- **shared/**: Types, schemas, utilities used by all platforms
- **server/**: Backend API shared by all clients

### Module Resolution
1. Babel resolves path aliases during transpilation
2. Metro bundles for mobile using babel.config.js
3. Next.js uses tsconfig.json paths for web
4. TypeScript uses tsconfig.json for type checking

## Testing Build Configuration

### Test Metro Bundler
```bash
npm run dev:mobile
# Should start Expo dev server without errors
```

### Test Type Checking
```bash
npm run typecheck
# Should compile without errors
```

### Test Linting
```bash
npm run lint
# Should show no critical errors
```

### Test Next.js Build
```bash
npm run build:client
# Should build successfully
```

## Next Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development**:
   ```bash
   # Terminal 1: Start backend
   npm run dev:server

   # Terminal 2: Start mobile or web
   npm run dev:mobile  # For mobile
   # OR
   npm run dev:client  # For web
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

4. **Generate Native Projects** (for custom native code):
   ```bash
   npm run prebuild
   ```

## Troubleshooting Checklist

- [ ] All dependencies installed: `npm install`
- [ ] Metro cache cleared: `npx expo start -c`
- [ ] Node modules cleaned: `rm -rf node_modules && npm install`
- [ ] TypeScript compiling: `npm run typecheck`
- [ ] Backend running: `npm run dev:server`
- [ ] Correct Node version: Node 18+ recommended
- [ ] Environment variables set (if needed)
- [ ] Network connectivity (for API calls)

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Metro Bundler](https://metrobundler.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
