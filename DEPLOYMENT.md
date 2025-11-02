# Stellr Deployment Guide

Complete guide for deploying Stellr React Native app to production, including builds, TestFlight distribution, and App Store submission.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [iOS Credentials Configuration](#ios-credentials-configuration)
4. [Building for Different Environments](#building-for-different-environments)
5. [TestFlight Distribution](#testflight-distribution)
6. [App Store Submission](#app-store-submission)
7. [Certificate Rotation](#certificate-rotation)
8. [Monitoring & Rollback](#monitoring--rollback)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- ✅ Apple Developer Account ($99/year) - **Required for iOS builds**
- ✅ Expo Account (Free tier sufficient)
- ✅ Supabase Project (already configured)
- ✅ RevenueCat Account (already configured)
- ✅ Sentry Account (for error monitoring)
- ✅ PostHog Account (for analytics)

### Required Tools
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# Verify login
eas whoami
```

### Verify Project Configuration
```bash
# Check EAS project is linked
eas project:info

# Should show:
# Project ID: 13a53cb4-f570-4dc8-977c-2d705152e163
# Owner: franciswade
```

---

## Environment Setup

### 1. Production Environment Variables

Create `.env.production` with the following:

```bash
# Production Environment
NODE_ENV=production
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_IS_BETA=true

# Supabase (Production)
EXPO_PUBLIC_SUPABASE_URL=https://bodiwrrbjpfuvepnpnsv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key

# RevenueCat (Production Keys - DO NOT enable payments until post-launch)
EXPO_PUBLIC_PAYMENTS_ENABLED=false
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_YOUR_PRODUCTION_KEY
# EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_YOUR_PRODUCTION_KEY  # Add when ready for Android

# Sentry Error Monitoring (REQUIRED FOR PRODUCTION)
EXPO_PUBLIC_SENTRY_ENABLED=true
EXPO_PUBLIC_SENTRY_DSN=https://YOUR_DSN@sentry.io/YOUR_PROJECT_ID

# PostHog Analytics
EXPO_PUBLIC_POSTHOG_HOST=https://eu.posthog.com

# Google Sign-In
EXPO_PUBLIC_GOOGLE_SIGNIN_ENABLED=true
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=979846004214-fli6poifij4nfm6rttjjfv1d04g2jted.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=979846004214-qa1ooknp39cs61ovtrqn5t6n6h0nl3ph.apps.googleusercontent.com

# Persona Identity Verification
EXPO_PUBLIC_PERSONA_TEMPLATE_ID=vtmpl_pmVNbdjTcg4Lf33LogDV7fSNrVmd
EXPO_PUBLIC_PERSONA_ENVIRONMENT=production
EXPO_PUBLIC_PERSONA_API_KEY=persona_YOUR_PRODUCTION_KEY
EXPO_PUBLIC_PERSONA_VERIFICATION_ENABLED=true

# App Version
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_BUILD_NUMBER=1
```

### 2. Add Secrets to EAS

Sensitive keys should be stored as EAS secrets (not in repository):

```bash
# Sentry DSN
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "YOUR_SENTRY_DSN_HERE"

# Supabase Anon Key (if not already public)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_SUPABASE_ANON_KEY"

# RevenueCat Keys
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "appl_YOUR_KEY"

# List all secrets to verify
eas secret:list
```

---

## iOS Credentials Configuration

### Step 1: Apple Developer Portal Setup

1. **Log in to Apple Developer Console**
   - URL: https://developer.apple.com
   - Navigate to: Certificates, Identifiers & Profiles

2. **Create App ID**
   ```
   Bundle ID: com.stellr.datingapp
   Name: Stellr Dating App

   Capabilities to enable:
   - Sign in with Apple
   - Push Notifications
   - Associated Domains
   - In-App Purchase
   ```

3. **Enable App Services**
   - Sign in with Apple: ✅ Enabled
   - Push Notifications: ✅ Enabled
   - Associated Domains: ✅ Enabled (for deep linking)

### Step 2: EAS Credentials Setup

```bash
# Start credentials configuration
eas credentials

# Select: iOS
# Select: Production
# Follow prompts to generate:
#   1. Distribution Certificate
#   2. Push Notification Key
#   3. Provisioning Profile

# Verify credentials are configured
eas credentials -p ios
```

### Step 3: Verify app.json Configuration

Ensure `app.json` has correct iOS settings:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.stellr.datingapp",
      "buildNumber": "1",
      "supportsTablet": false,
      "associatedDomains": ["applinks:stellr.app"],
      "config": {
        "usesNonExemptEncryption": false
      }
    }
  }
}
```

---

## Building for Different Environments

### Development Build (Internal Testing)

```bash
# Build for development (includes dev tools, debugging)
eas build --profile development --platform ios

# Wait for build to complete (~10-15 minutes)
# Download and install on device via TestFlight or direct install
```

### Preview Build (Beta Testing)

```bash
# Build for beta testers (production-like, but with beta flags)
eas build --profile preview --platform ios

# This build will have:
# - EXPO_PUBLIC_IS_BETA=true
# - EXPO_PUBLIC_PAYMENTS_ENABLED=false
# - Distribution: Internal (TestFlight)
```

### Production Build (App Store Release)

```bash
# Build for App Store submission
eas build --profile production --platform ios --auto-submit

# Or build and submit separately:
eas build --profile production --platform ios
# Then:
eas submit --platform ios --latest
```

### Check Build Status

```bash
# View build status
eas build:list

# View specific build details
eas build:view <build-id>

# View build logs
eas build:view <build-id> --json
```

---

## TestFlight Distribution

### Step 1: Submit Build to App Store Connect

```bash
# After preview/production build completes
eas submit --platform ios --latest

# Or specify a specific build
eas submit --platform ios --id <build-id>
```

### Step 2: Configure TestFlight in App Store Connect

1. **Log in to App Store Connect**
   - URL: https://appstoreconnect.apple.com
   - Navigate to: My Apps → Stellr

2. **Configure Beta App Information**
   - Go to: TestFlight → iOS → Beta App Information
   - Fill in:
     - Beta App Description
     - Feedback Email: support@stellr.app
     - Marketing URL: https://stellr.app
     - Privacy Policy URL: https://stellr.app/privacy

3. **Configure Test Information**
   - Go to: TestFlight → Test Information
   - Fill in:
     - What to Test: "Welcome to Stellr beta! Test matching, messaging, and profile features."
     - Beta App Review Information
     - Contact Information

4. **Export Compliance**
   - Answer "No" to encryption questions (using standard HTTPS only)
   - Or select: "Your app uses encryption but qualifies for exemption"

### Step 3: Add Internal Testers

```bash
# Internal testers (no review required, instant access)
# Add in App Store Connect:
# TestFlight → Internal Testing → Add Internal Testers

# Suggested internal testers:
# - Development team (3-5 people)
# - Key stakeholders
# - QA team members
```

**Internal Testing Groups:**
- **Group Name:** Core Team
- **Build Access:** Automatic (all builds)
- **Members:** Add emails of internal testers

### Step 4: Create External Testing Group (Beta Launch)

```bash
# External testers (requires Beta App Review, 1-2 days approval)
# Create group in App Store Connect:
# TestFlight → External Testing → Add Group

# Group configuration:
```

**External Testing Groups:**
- **Group Name:** Beta Testers
- **Public Link:** ✅ Enabled (for easy distribution)
- **Maximum Testers:** 10-20 for initial beta
- **Builds:** Select preview build
- **Auto-notify:** ✅ Enabled

### Step 5: Distribute to Beta Testers

**Option A: Public Link (Recommended for Beta)**
```
1. Create public link in TestFlight
2. Share link: https://testflight.apple.com/join/YOUR_CODE
3. Send link via email/Slack/Discord to beta testers
```

**Option B: Email Invitations**
```
1. Add tester emails in App Store Connect
2. Testers receive automatic invitation email
3. They click link → Download TestFlight → Install app
```

---

## App Store Submission

### Preparation Checklist

- [ ] All features tested and working
- [ ] Certificate pinning validated (pins expire 2025-12-31)
- [ ] Sentry error monitoring active
- [ ] PostHog analytics tracking events
- [ ] Privacy Policy published at https://stellr.app/privacy
- [ ] Terms of Service published at https://stellr.app/terms
- [ ] App Store screenshots prepared (6.7", 6.5", 5.5" sizes)
- [ ] App Store description written
- [ ] Keywords selected (max 100 characters)
- [ ] App icon finalized (1024x1024px)
- [ ] Preview video prepared (optional but recommended)

### Step 1: Create App Store Listing

```bash
# In App Store Connect:
# My Apps → + → New App

# Fill in:
# - Platform: iOS
# - Name: Stellr
# - Primary Language: English (U.S.)
# - Bundle ID: com.stellr.datingapp
# - SKU: stellr-dating-app
```

### Step 2: Configure App Information

**App Store Page:**
- **Name:** Stellr
- **Subtitle:** Astrological Dating & Matching
- **Privacy Policy URL:** https://stellr.app/privacy
- **Category:** Primary = Lifestyle, Secondary = Social Networking
- **Content Rights:** Does not contain third-party content
- **Age Rating:** 17+ (Frequent/Intense Mature/Suggestive Themes)

### Step 3: Add Screenshots & Media

**Required Sizes:**
- 6.7" Display (iPhone 14 Pro Max): 1290 x 2796 pixels
- 6.5" Display (iPhone 11 Pro Max): 1242 x 2688 pixels
- 5.5" Display (iPhone 8 Plus): 1242 x 2208 pixels

**Screenshot Strategy:**
- Screen 1: Onboarding/Welcome
- Screen 2: Profile creation
- Screen 3: Matching interface
- Screen 4: Messaging
- Screen 5: Premium features

### Step 4: Configure Pricing & Availability

```
# In-App Purchases:
# - Monthly Premium: $9.99/month
# - Annual Premium: $79.99/year (when ready)

# Pricing:
# - Free download
# - In-App Purchases available

# Availability:
# - All territories (or select specific countries)
```

### Step 5: Submit for Review

```bash
# Build Checklist:
- [ ] Build uploaded to App Store Connect
- [ ] All metadata complete
- [ ] Screenshots uploaded
- [ ] Privacy Policy and Terms linked
- [ ] Age rating set to 17+
- [ ] Export compliance completed

# Submit:
# App Store Connect → Version → Submit for Review
```

**Expected Review Time:** 2-3 business days (can be faster)

### Step 6: Respond to Review Feedback

If rejected, common issues:
- **Age Rating:** Ensure 17+ for dating app
- **Privacy:** Add App Privacy details (data collection)
- **Permissions:** Justify camera/location usage in review notes
- **Persona Verification:** Explain safety/verification features

---

## Certificate Rotation

### ⚠️ CRITICAL: Certificate Expiry Dates

**Certificate Pins Expire:**
- Supabase: 2025-12-31 (63 days from 2025-10-28)
- RevenueCat: 2026-01-31
- PostHog: 2026-02-28

**Rotation Schedule:**
1. **30 days before expiry (2025-12-01):**
   - Extract new certificate pins
   - Update `src/utils/certificate-pinning.ts`
   - Deploy new app version

2. **Wait 30 days for users to update**

3. **After 30 days:**
   - Server can safely rotate certificates
   - Old pins will still work for updated users

### Extract New Certificate Pins

```bash
# Supabase
echo | openssl s_client -connect bodiwrrbjpfuvepnpnsv.supabase.co:443 \
  -servername bodiwrrbjpfuvepnpnsv.supabase.co 2>/dev/null | \
  openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | base64

# RevenueCat
echo | openssl s_client -connect api.revenuecat.com:443 \
  -servername api.revenuecat.com 2>/dev/null | \
  openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | base64

# PostHog
echo | openssl s_client -connect eu.posthog.com:443 \
  -servername eu.posthog.com 2>/dev/null | \
  openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | base64
```

### Update Certificate Pins

1. Update `src/utils/certificate-pinning.ts`:
   ```typescript
   const CERTIFICATE_PINS: CertificatePin[] = [
     {
       hostname: 'bodiwrrbjpfuvepnpnsv.supabase.co',
       leafPin: 'sha256/NEW_PIN_HERE',
       caPin: 'sha256/NEW_CA_PIN_HERE',
       validUntil: '2026-03-31', // New expiry date
     },
     // ... update others
   ];
   ```

2. Build and deploy new version
3. Monitor Sentry for pinning failures

See `CERTIFICATE_ROTATION.md` for detailed procedures.

---

## Monitoring & Rollback

### Post-Deployment Monitoring

**First 24 Hours:**
```bash
# Monitor Sentry for errors
# Dashboard: https://sentry.io/organizations/YOUR_ORG/projects/stellr/

# Check for:
# - Certificate pinning failures
# - Authentication errors
# - Payment processing issues
# - Crash-free rate

# Monitor PostHog Analytics
# Dashboard: https://eu.posthog.com

# Track:
# - App installs
# - User signups
# - Paywall impressions
# - Purchase conversions
```

### Rollback Procedure

**If Critical Issues Found:**

1. **Immediate:**
   ```bash
   # Remove current build from TestFlight/App Store
   # In App Store Connect: Remove from Sale
   ```

2. **Fix Issues:**
   ```bash
   # Fix bugs in code
   # Create hotfix build
   eas build --profile production --platform ios
   ```

3. **Re-submit:**
   ```bash
   # Submit hotfix build
   eas submit --platform ios --latest
   ```

**Expedited Review:**
- Contact Apple Developer Support
- Explain critical bug (security/crash)
- Request expedited review (usually granted)

---

## Troubleshooting

### Build Failures

**Issue: Credentials not configured**
```bash
Error: Could not find credentials

# Solution:
eas credentials -p ios
# Regenerate credentials
```

**Issue: Build timeout**
```bash
Build timed out after 45 minutes

# Solution:
# 1. Check for large dependencies
# 2. Optimize node_modules
# 3. Contact EAS support for resource increase
```

### TestFlight Issues

**Issue: Build not appearing in TestFlight**
```
Build uploaded but not visible

# Solution:
1. Wait 10-15 minutes for processing
2. Check export compliance is completed
3. Verify build passed App Store review checks
```

**Issue: Beta testers can't install**
```
TestFlight says "No apps available"

# Solution:
1. Verify tester was added correctly
2. Check tester accepted invitation email
3. Verify build is approved for external testing
```

### Certificate Pinning Issues

**Issue: API calls failing with SSL error**
```
SSL Certificate validation failed

# Solution:
1. Check certificate hasn't expired
2. Verify pins are correct
3. Temporarily disable pinning in dev:
   process.env.EXPO_PUBLIC_APP_ENV = 'development'
```

### Sentry Not Receiving Events

**Issue: No error events in Sentry**
```
# Check:
1. EXPO_PUBLIC_SENTRY_ENABLED=true in .env.production
2. DSN is correct
3. Build includes Sentry configuration
4. Test with intentional error:
   throw new Error('Test Sentry');
```

---

## Post-Launch Checklist

**Within 24 Hours:**
- [ ] Verify Sentry receiving events
- [ ] Check PostHog tracking active users
- [ ] Monitor crash-free rate (target: >95%)
- [ ] Review first user feedback
- [ ] Check server logs for API errors

**Within 1 Week:**
- [ ] Analyze user retention (Day 1, Day 3, Day 7)
- [ ] Review most common user paths
- [ ] Identify drop-off points in onboarding
- [ ] Collect and categorize beta feedback
- [ ] Plan first update based on feedback

**Within 1 Month:**
- [ ] Certificate rotation reminder set (2025-12-01)
- [ ] Review crash logs and fix top issues
- [ ] Analyze conversion funnel
- [ ] Plan feature roadmap based on usage
- [ ] Consider enabling real payments

---

## Support & Resources

**Expo Documentation:**
- EAS Build: https://docs.expo.dev/build/introduction/
- EAS Submit: https://docs.expo.dev/submit/introduction/
- App Store Guidelines: https://developer.apple.com/app-store/review/guidelines/

**Need Help?**
- Expo Discord: https://chat.expo.dev
- Apple Developer Forums: https://developer.apple.com/forums/
- Internal Team: Slack #stellr-deployment

---

**Last Updated:** 2025-10-28
**Version:** 1.0.0
**Maintained By:** Stellr Engineering Team
