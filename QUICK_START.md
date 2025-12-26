# Quick Start - Expo/React Native Build

## Installation (First Time Only)

```bash
npm install
```

## Verify Setup

```bash
node check-dependencies.js
```

## Start Development

### Option 1: Mobile App (Expo)

```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Mobile
npm run dev:mobile
```

Then:
- Scan QR code with Expo Go app (iOS/Android)
- Press `w` to open in web browser
- Press `a` for Android emulator
- Press `i` for iOS simulator

### Option 2: Web App (Next.js)

```bash
npm run dev
```

Visit: http://localhost:3000

## Common Commands

### Development
```bash
npm run dev              # Web + Backend
npm run dev:mobile       # Mobile (Expo)
npm run dev:server       # Backend only
npm run dev:client       # Web only
```

### Mobile Platforms
```bash
npm run android          # Run Android
npm run ios              # Run iOS
npm run web:expo         # Expo web
```

### Utilities
```bash
npm run typecheck        # Check TypeScript
npm run lint             # Run ESLint
npm run format           # Format code
npx expo start -c        # Clear Metro cache
```

## Troubleshooting

### Metro Bundler Error
```bash
npx expo start -c        # Clear cache
```

### Module Not Found
```bash
rm -rf node_modules
npm install
npx expo start -c
```

### TypeScript Errors
```bash
npm run typecheck        # Find errors
```

### API Not Connecting
1. Start backend: `npm run dev:server`
2. Check port 5000 is available
3. For physical devices, use your computer's IP

## Project Structure

```
/app         - Next.js web app
/client      - React Native mobile app
/server      - Express backend
/shared      - Shared code
```

## Path Aliases

```typescript
import Component from "@/components/Component"  // client/
import { Type } from "@shared/types"            // shared/
import api from "@server/api"                   // server/
```

## Documentation

- **SETUP_GUIDE.md** - Detailed setup & troubleshooting
- **BUILD_CONFIGURATION.md** - Architecture deep dive
- **EXPO_BUILD_FIX_SUMMARY.md** - Changes summary

## Quick Checks

All green? You're ready to go!

```bash
✅ node check-dependencies.js    # All dependencies installed
✅ npm run typecheck              # No TypeScript errors
✅ npm run dev:server             # Backend starts on port 5000
✅ npm run dev:mobile             # Expo starts without errors
```

## Support

Issue? Check in this order:
1. Clear cache: `npx expo start -c`
2. Reinstall: `rm -rf node_modules && npm install`
3. Read: SETUP_GUIDE.md
4. Check: BUILD_CONFIGURATION.md
