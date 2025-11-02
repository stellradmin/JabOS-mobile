# Device Testing Guide - EAS Build

**Purpose:** Test Stellr on a physical iOS device before TestFlight distribution

**Date:** 2025-10-29

---

## Build Options for Device Testing

### Option 1: Preview Build (RECOMMENDED)

**Best for:** Production-like testing on your device

**Pros:**
- Release mode (same as production)
- No dev client overhead
- Tests actual user experience
- Certificate pinning active
- Beta flags enabled (`EXPO_PUBLIC_IS_BETA=true`)

**Cons:**
- Longer build time (~15-20 minutes)
- No live reload or dev tools

**Command:**
```bash
eas build --profile preview --platform ios
```

### Option 2: Development Build

**Best for:** Active development with hot reload

**Pros:**
- Faster iteration
- Dev tools available
- Live reload enabled

**Cons:**
- Debug mode (slower performance)
- Different behavior than production
- Not representative of user experience

**Command:**
```bash
eas build --profile development --platform ios
```

---

## Recommended: Preview Build for Testing

Since you want to test before TestFlight, I recommend using the **preview** profile. This gives you a production-like experience on your device.

---

## Step-by-Step: Building & Installing

### Step 1: Start the Build

```bash
# Build preview version for physical device
eas build --profile preview --platform ios
```

**What happens:**
1. EAS uploads your code to cloud builders
2. Builds the iOS app (15-20 minutes)
3. Generates an IPA file
4. Provides download link and QR code

### Step 2: Monitor Build Progress

```bash
# Check build status
eas build:list

# View specific build details
eas build:view <build-id>
```

**Or:**
- Visit: https://expo.dev/accounts/franciswade/projects/stellr/builds

### Step 3: Install on Your Device

When build completes, you'll see:
```
✔ Build finished

Install and run the app:
› Scan the QR code below with your iOS device
› Or open this URL on your device: https://expo.dev/artifacts/...
```

**Installation Methods:**

#### Method A: QR Code (Easiest)
1. Open Camera app on your iPhone
2. Point at the QR code in terminal
3. Tap the notification
4. Follow prompts to install

#### Method B: Direct Link
1. Copy the URL from terminal
2. Open Safari on your iPhone
3. Paste and go to the URL
4. Tap "Install"

#### Method C: Via Expo Go (If using development build)
1. Install Expo Go from App Store
2. Scan QR code in Expo Go app
3. App launches in Expo Go

---

## What to Test on Device

Use this checklist to test critical functionality on your physical device.

### 🔐 Security & Certificate Pinning

- [ ] **App launches successfully** (no SSL errors)
- [ ] **Can sign up with email** (Supabase connection works)
- [ ] **Can sign in with Apple** (certificate pinning allows request)
- [ ] **Can sign in with Google** (certificate pinning allows request)
- [ ] **Check Sentry** - No certificate pinning errors logged

**Why Important:** Certificate pinning can cause issues if not configured correctly for production URLs.

### 👤 Authentication & Onboarding

- [ ] **Create account** with email/Apple/Google
- [ ] **Complete profile setup** (3 steps)
- [ ] **Birth chart generates** correctly
- [ ] **Upload photos** from camera roll
- [ ] **Take photo with camera** (permission prompt works)
- [ ] **Complete questionnaire**
- [ ] **Persona verification** loads and works

### 🎯 Core Features

- [ ] **Discover screen loads** with profiles
- [ ] **Swipe gestures work** smoothly
- [ ] **Send invites** (count decrements)
- [ ] **Reach 0 invites** and see paywall
- [ ] **Paywall shows "Coming Soon"** in beta mode
- [ ] **Create a match** (mutual invite)
- [ ] **Receive match notification** (if enabled)
- [ ] **Send messages** in real-time
- [ ] **Receive messages** with notifications

### 📱 Device-Specific Testing

- [ ] **App works in background** and returns correctly
- [ ] **Push notifications arrive** (if permission granted)
- [ ] **Tapping notification** opens correct screen
- [ ] **Low connectivity** shows appropriate errors
- [ ] **Offline mode** handles gracefully
- [ ] **App doesn't drain battery** excessively
- [ ] **No overheating** during normal use
- [ ] **Memory usage** is reasonable (check in Settings > General > iPhone Storage)

### 🎨 UI/UX on Device

- [ ] **Layout looks correct** for your device size
- [ ] **Text is readable** (not too small/large)
- [ ] **Touch targets are tappable** (not too small)
- [ ] **Animations are smooth** (60fps)
- [ ] **No visual glitches** or overlapping elements
- [ ] **Safe area insets** respected (no content behind notch)

### 🐛 Critical Bugs to Watch For

**Stop testing and fix immediately if:**
- ❌ App crashes on launch
- ❌ Cannot create account
- ❌ Cannot sign in
- ❌ SSL/Certificate errors appear
- ❌ App freezes or hangs
- ❌ Data loss occurs

**Note but continue testing:**
- ⚠️ Minor UI issues
- ⚠️ Slow loading times
- ⚠️ Non-critical feature bugs

---

## Debugging on Device

### View Console Logs

If you need to see logs while testing:

```bash
# Monitor device logs (must be connected via USB)
npx react-native log-ios
```

### Check Sentry for Errors

1. Go to your Sentry dashboard
2. Filter by environment: preview
3. Look for errors in real-time as you test

### Check PostHog Analytics

1. Go to PostHog dashboard
2. Filter by your user ID
3. Verify events are being tracked

---

## Common Issues & Solutions

### Issue: "Unable to Install"

**Cause:** Device not registered with Apple Developer
**Solution:**
1. Connect device to Mac
2. Open Xcode > Window > Devices and Simulators
3. Device should appear and register automatically
4. Rebuild: `eas build --profile preview --platform ios`

### Issue: "Untrusted Enterprise Developer"

**Cause:** Need to trust the developer certificate
**Solution:**
1. Settings > General > VPN & Device Management
2. Tap your developer profile
3. Tap "Trust"

### Issue: App Shows SSL/Certificate Error

**Cause:** Certificate pinning configuration issue
**Solution:**
1. Check pins in `src/utils/certificate-pinning.ts`
2. Verify production URLs are correct
3. Check Sentry for specific error details

### Issue: App Crashes on Launch

**Cause:** Various (native module, config, etc.)
**Solution:**
1. Check Sentry for crash reports
2. Look for native module initialization errors
3. Verify all env vars are set correctly

### Issue: "This app cannot be installed"

**Cause:** Provisioning profile doesn't include your device
**Solution:**
1. EAS should auto-register devices
2. If not, go to: https://expo.dev/accounts/franciswade/projects/stellr/credentials
3. Add device manually
4. Rebuild

---

## After Testing: Report Issues

### Document Findings

Create a file: `DEVICE_TEST_RESULTS.md`

```markdown
# Device Test Results

**Date:** YYYY-MM-DD
**Device:** iPhone [Model]
**iOS Version:** [Version]
**Build:** [Build Number from app]

## Test Results

### ✅ Working
- Feature 1
- Feature 2

### ❌ Issues Found
1. **Issue:** Description
   - **Severity:** P0/P1/P2/P3
   - **Steps to Reproduce:** ...
   - **Expected:** ...
   - **Actual:** ...

2. **Issue:** Description
   ...

## Recommendations
- Fix P0 issues before TestFlight
- P1 issues should be fixed during internal testing
- P2/P3 can wait for beta feedback
```

### Share Results

If working in a team:
1. Commit `DEVICE_TEST_RESULTS.md` to Git
2. Create GitHub issues for each bug
3. Prioritize by severity (P0 → P1 → P2 → P3)

---

## Next Steps After Device Testing

### If All Tests Pass ✅

1. **Configure TestFlight**
   - Follow `DEPLOYMENT.md` TestFlight section
   - Submit build to App Store Connect
   - Add internal testers

2. **Internal Beta Testing**
   - Distribute to 3-5 team members
   - Test for 2-3 days
   - Fix any P0/P1 bugs

3. **External Beta Launch**
   - Follow `BETA_TESTING_PLAN.md`
   - Distribute to 10-20 testers
   - Collect feedback for 2 weeks

### If Issues Found ❌

1. **Fix P0 Issues Immediately**
   - App crashes
   - Cannot sign in/sign up
   - Certificate errors
   - Data loss

2. **Build and Test Again**
   ```bash
   # After fixes
   eas build --profile preview --platform ios
   ```

3. **Repeat Testing**
   - Go through checklist again
   - Verify fixes work

---

## Build Commands Reference

```bash
# Build preview for device testing
eas build --profile preview --platform ios

# Build development with dev client
eas build --profile development --platform ios

# Check build status
eas build:list

# View specific build
eas build:view <build-id>

# Cancel running build
eas build:cancel

# View build logs
eas build:view <build-id> --json
```

---

## Device Requirements

- iPhone 8 or newer
- iOS 15.0 or higher
- Registered with your Apple Developer account (EAS handles this)
- Connected to internet (for initial install)

---

## Estimated Timeline

- **Build Time:** 15-20 minutes (preview)
- **Install Time:** 2-3 minutes
- **Testing Time:** 30-60 minutes (comprehensive)
- **Total:** ~1-2 hours for thorough device testing

---

**Ready to build?** Run:
```bash
eas build --profile preview --platform ios
```

Then follow the QR code or URL to install on your device!

---

**Last Updated:** 2025-10-29
**Version:** 1.0.0
