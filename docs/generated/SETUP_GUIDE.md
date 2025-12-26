# Quick Setup Guide for Expo/React Native Build

## Initial Setup

### 1. Install Dependencies
```bash
npm install
```

This will install all required Expo, React Native, and build tool dependencies.

### 2. Verify Installation
```bash
# Check if Expo CLI is available
npx expo --version

# Check TypeScript
npm run typecheck

# Check linting
npm run lint
```

## Running the Application

### Web Development (Next.js)
```bash
# Start both backend and Next.js web app
npm run dev

# Or separately:
npm run dev:server  # Backend API (port 5000)
npm run dev:client  # Next.js web (port 3000)
```

### Mobile Development (Expo/React Native)
```bash
# Start backend first
npm run dev:server

# Then in another terminal, start Expo
npm run dev:mobile

# Or use:
npm run start:mobile
```

### Platform-Specific Builds
```bash
# Android (requires Android Studio)
npm run android

# iOS (requires macOS and Xcode)
npm run ios

# Web via Expo
npm run web:expo
```

## Common Issues & Quick Fixes

### Issue 1: Metro Bundler Won't Start

**Symptoms:**
- "Unable to resolve module"
- "Metro bundler has encountered an error"

**Quick Fix:**
```bash
# Clear all caches
npx expo start -c

# If that doesn't work, nuclear option:
rm -rf node_modules .expo
npm install
npx expo start -c
```

### Issue 2: TypeScript Errors

**Symptoms:**
- "Cannot find module '@/...'"
- Type errors in imports

**Quick Fix:**
```bash
# Verify TypeScript configuration
npm run typecheck

# Check if paths are correct in tsconfig.json
cat tsconfig.json | grep -A 5 "paths"

# Restart your IDE/editor
```

### Issue 3: Babel Transform Errors

**Symptoms:**
- "SyntaxError: Unexpected token"
- "Unknown plugin 'react-native-reanimated/plugin'"

**Quick Fix:**
```bash
# Ensure babel-plugin-module-resolver is installed
npm install --save-dev babel-plugin-module-resolver

# Clear Metro cache
npx expo start -c
```

### Issue 4: SVG Import Errors

**Symptoms:**
- "Error: Invalid call at line X: require(...)"
- SVG files not loading

**Quick Fix:**
```bash
# Install SVG transformer
npm install --save-dev react-native-svg-transformer
npm install react-native-svg

# Clear cache and restart
npx expo start -c
```

### Issue 5: API Connection Failed

**Symptoms:**
- "Network request failed"
- API calls timeout

**Quick Fix:**
1. Ensure backend is running:
   ```bash
   npm run dev:server
   ```

2. Check server is on port 5000:
   ```bash
   lsof -i :5000
   # or
   netstat -an | grep 5000
   ```

3. For physical devices, update API URL to use your computer's IP:
   - Find your IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
   - Set in app: Change localhost to your IP (e.g., 192.168.1.100)

### Issue 6: Module Not Found After Install

**Symptoms:**
- "Module not found: Can't resolve 'expo'"
- Package installed but not found

**Quick Fix:**
```bash
# Clear package manager cache
npm cache clean --force

# Remove and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Metro cache
npx expo start -c
```

### Issue 7: Prebuild Errors

**Symptoms:**
- "Error: Unable to generate native projects"
- Prebuild fails

**Quick Fix:**
```bash
# Clean prebuild
npm run prebuild:clean

# If that fails, remove and regenerate:
rm -rf android ios
npm run prebuild
```

## Environment Setup

### Required Tools
- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher
- **Expo CLI**: Installed via npx (no global install needed)

### Optional Tools (for native builds)
- **Android Studio**: For Android development
- **Xcode**: For iOS development (macOS only)
- **CocoaPods**: For iOS dependencies (macOS only)

### Verify Tools
```bash
node --version    # Should be v18+
npm --version     # Should be v9+
npx expo --version # Should work without errors
```

## Development Workflow

### Recommended Terminal Setup

**Terminal 1 - Backend:**
```bash
npm run dev:server
# Keep this running
```

**Terminal 2 - Frontend (choose one):**
```bash
# For web development:
npm run dev:client

# For mobile development:
npm run dev:mobile
```

### Hot Reload
- **Next.js**: Automatically reloads on file changes
- **Expo**: Shake device or press `r` in terminal to reload
- **Fast Refresh**: Works automatically for most React changes

### Debugging

**Metro Bundler:**
- Press `j` to open debugger
- Press `r` to reload
- Press `m` to toggle menu

**React DevTools:**
```bash
# Install globally
npm install -g react-devtools

# Run alongside Expo
react-devtools
```

**Logs:**
```bash
# View Metro bundler logs
# (already visible in terminal)

# View React Native logs (Android)
npx react-native log-android

# View React Native logs (iOS)
npx react-native log-ios
```

## Build Checklist

Before committing or deploying, verify:

- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Code is formatted: `npm run format`
- [ ] Backend starts: `npm run dev:server`
- [ ] Web builds: `npm run build:client`
- [ ] Mobile bundles: `npx expo export`
- [ ] No console errors in development

## Project Structure Quick Reference

```
/
├── app/                    # Next.js web app (App Router)
├── client/                 # React Native mobile app
│   ├── components/        # Mobile UI components
│   ├── navigation/        # React Navigation setup
│   ├── screens/           # Mobile screens
│   ├── App.tsx           # Mobile app entry
│   └── index.js          # Expo entry point
├── server/                # Express backend (shared)
├── shared/                # Shared types and utilities
├── app.json              # Expo configuration
├── babel.config.js       # Babel configuration
├── metro.config.js       # Metro bundler config
├── next.config.js        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Performance Tips

1. **Clear caches regularly** when switching between platforms:
   ```bash
   npx expo start -c
   ```

2. **Use development builds** for faster iteration:
   ```bash
   npm run dev:mobile
   ```

3. **Enable Fast Refresh** (enabled by default in React Native 0.61+)

4. **Minimize re-renders** by using React.memo and useCallback

5. **Lazy load screens** with React.lazy and Suspense

## Getting Help

### Check Configuration
```bash
# View current configuration
cat babel.config.js
cat metro.config.js
cat app.json
cat tsconfig.json
```

### Verify Dependencies
```bash
# List all Expo dependencies
npm list expo react-native

# Check for conflicts
npm ls
```

### Reset Everything
```bash
# Nuclear option - fresh start
rm -rf node_modules .expo .next android ios
npm cache clean --force
npm install
npx expo start -c
```

## Next Steps

1. **Read**: `BUILD_CONFIGURATION.md` for detailed architecture
2. **Install**: Run `npm install` to get all dependencies
3. **Start**: Run `npm run dev:server` then `npm run dev:mobile`
4. **Explore**: Check `/client` for mobile code, `/app` for web code
5. **Build**: Follow Expo documentation for production builds

## Quick Links

- [BUILD_CONFIGURATION.md](./BUILD_CONFIGURATION.md) - Detailed build config
- [Expo Docs](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Metro Bundler](https://metrobundler.dev/)
- [Next.js Docs](https://nextjs.org/docs)
