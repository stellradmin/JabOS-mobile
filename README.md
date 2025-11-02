# Stellr Mobile App

React Native mobile application for Stellr dating platform built with Expo.

## 🚀 Status

**Status:** ✅ Production-Ready (iOS)
**Last Updated:** 2025-10-26
**Platform:** iOS (Android delayed)
**Framework:** React Native (Expo SDK 52)

## 📱 Features

- ✅ Apple Sign-In & Google Sign-In
- ✅ Astrological compatibility matching
- ✅ Real-time messaging with photos
- ✅ RevenueCat subscription management
- ✅ Persona identity verification
- ✅ Location-based matching
- ✅ User preferences & settings

## 🔧 Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Xcode 15+) or physical device
- Supabase backend running (see `../stellr-backend/README.md`)

### Installation

```bash
cd stellr-frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Environment Variables

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Payments
EXPO_PUBLIC_PAYMENTS_ENABLED=true
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_oRIyPVnWWTLTRfcvKJqCyzINjsx

# Google OAuth
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_client_id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id

# Persona Identity Verification
EXPO_PUBLIC_PERSONA_VERIFICATION_ENABLED=true
EXPO_PUBLIC_PERSONA_TEMPLATE_ID=vtmpl_pmVNbdjTcg4Lf33LogDV7fSNrVmd
EXPO_PUBLIC_PERSONA_ENVIRONMENT=sandbox
EXPO_PUBLIC_PERSONA_API_KEY=your_api_key

# Analytics
EXPO_PUBLIC_POSTHOG_API_KEY=your_api_key
EXPO_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
```

## 🏃‍♂️ Development

### Start Development Server

```bash
npx expo start
```

Options:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app (physical device)

### Run on iOS

```bash
# iOS Simulator
npx expo start --ios

# Or use npm script
npm run ios
```

### Clear Cache

```bash
# Clear Expo cache
npx expo start --clear

# Or
npx expo start -c
```

## 📂 Project Structure

```
stellr-frontend/
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab navigation
│   │   ├── dashboard.tsx
│   │   ├── date-night.tsx
│   │   ├── messages.tsx
│   │   ├── profile.tsx
│   │   └── settings.tsx
│   ├── auth.tsx
│   ├── onboarding.tsx
│   └── ...
│
├── components/                    # Reusable components
│   ├── matching/
│   ├── messaging/
│   ├── profile/
│   └── ...
│
├── src/
│   ├── lib/                      # Core utilities
│   ├── services/                 # API and business logic
│   ├── hooks/                    # Custom React hooks
│   ├── types/                    # TypeScript types
│   └── utils/                    # Helper functions
│
├── assets/                       # Images, fonts, etc.
├── .env                          # Environment variables
├── app.json                      # Expo configuration
└── package.json                  # Dependencies
```

## 🏗️ Building

### Development Build

```bash
# Create development build
eas build --profile development --platform ios

# Install on device
eas build:run --profile development --platform ios
```

### Production Build

```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Type Checking

```bash
# Run TypeScript compiler
npx tsc --noEmit
```

## 📦 Key Dependencies

### Core
- `expo` - Expo SDK framework
- `react-native` - React Native core
- `react-navigation` - Navigation library

### Backend & Auth
- `@supabase/supabase-js` - Supabase client
- `@react-native-google-signin/google-signin` - Google auth
- `expo-apple-authentication` - Apple Sign-In

### Payments
- `react-native-purchases` - RevenueCat SDK

### UI & Styling
- `react-native-reanimated` - Animations
- `react-native-gesture-handler` - Gestures
- `expo-linear-gradient` - Gradients

## 🔐 Security

### Credentials
- Never commit `.env` file
- Use environment variables for all sensitive data
- Apple credentials stored in `/keys/` folder (gitignored)

### Authentication
- JWT tokens managed by Supabase Auth
- Biometric authentication supported
- Secure storage for sensitive data

## 🚀 Deployment

### iOS Production Checklist

1. **Environment Setup**
   ```bash
   EXPO_PUBLIC_PAYMENTS_ENABLED=true
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_oRIyPVnWWTLTRfcvKJqCyzINjsx
   ```

2. **Build**
   ```bash
   eas build --platform ios --profile production
   ```

3. **Test Build**
   - Install on physical device
   - Test all core features
   - Verify payment flow
   - Test authentication

4. **Submit**
   ```bash
   eas submit --platform ios
   ```

5. **Monitor**
   - Check Sentry for errors
   - Monitor PostHog analytics
   - Watch App Store Connect for reviews

## 🐛 Troubleshooting

### Metro bundler issues

```bash
# Clear watchman
watchman watch-del-all

# Clear Metro cache
npx expo start -c

# Reinstall node_modules
rm -rf node_modules
npm install
```

### iOS build errors

```bash
# Clean iOS build
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..

# Rebuild
npx expo run:ios
```

### Environment variables not loading

```bash
# Restart Expo after .env changes
# Kill server (Ctrl+C) and restart
npx expo start -c
```

### Supabase connection errors

- Check backend is running: `cd ../stellr-backend && supabase status`
- Verify `EXPO_PUBLIC_SUPABASE_URL` is correct
- Check `EXPO_PUBLIC_SUPABASE_ANON_KEY` is set

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Supabase Client Documentation](https://supabase.com/docs/reference/javascript)
- [RevenueCat Documentation](https://docs.revenuecat.com/)

## 🎯 Next Steps

- See `../IOS_PRODUCTION_LAUNCH_READY.md` for launch checklist
- See `../FINAL_PRODUCTION_AUDIT.md` for security audit
- See `../QUICK_START.md` for quick setup guide

---

**For development support, see:** `../README.md`
