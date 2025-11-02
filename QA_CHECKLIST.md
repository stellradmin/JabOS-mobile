# Stellr Pre-Release QA Checklist

**Purpose:** Manual testing checklist to verify all critical functionality before distributing builds to beta testers or production users.

**Instructions:**
- Test on at least 2 different iOS versions (e.g., iOS 15, iOS 17)
- Test on at least 2 different device sizes (e.g., iPhone SE, iPhone 14 Pro Max)
- Complete ALL sections marked as "Critical" before release
- Document any failures in GitHub Issues with priority labels
- Re-test failed items after fixes are deployed

---

## Build Information

**Date:** _______________
**Build Number:** _______________
**Version:** _______________
**Tester Name:** _______________
**Device:** _______________
**iOS Version:** _______________

---

## 1. Authentication & Onboarding (Critical)

### Sign Up

- [ ] **Email Sign Up**
  - [ ] Can create account with valid email
  - [ ] Shows error for invalid email format
  - [ ] Shows error for weak password
  - [ ] Sends verification email successfully
  - [ ] Email verification link works
  - [ ] Shows appropriate loading states

- [ ] **Apple Sign-In**
  - [ ] "Continue with Apple" button appears
  - [ ] Opens Apple authentication prompt
  - [ ] Successfully authenticates and creates account
  - [ ] Handles user cancellation gracefully
  - [ ] Works with "Hide My Email" feature

- [ ] **Google Sign-In**
  - [ ] "Continue with Google" button appears
  - [ ] Opens Google authentication flow
  - [ ] Successfully authenticates and creates account
  - [ ] Handles user cancellation gracefully
  - [ ] Shows appropriate error messages on failure

### Sign In

- [ ] **Email Sign In**
  - [ ] Can sign in with valid credentials
  - [ ] Shows error for wrong password
  - [ ] Shows error for non-existent account
  - [ ] "Forgot Password" flow works
  - [ ] Password reset email arrives

- [ ] **Social Sign In**
  - [ ] Apple Sign-In works for returning users
  - [ ] Google Sign-In works for returning users
  - [ ] Correctly identifies existing accounts

### Profile Setup (3 Steps)

- [ ] **Step 1: Birth Chart**
  - [ ] Date picker works correctly
  - [ ] Time picker works correctly
  - [ ] Location search finds cities
  - [ ] Can skip time if unknown
  - [ ] Birth chart generates successfully
  - [ ] Shows loading state during generation
  - [ ] Can proceed to next step

- [ ] **Step 2: Photos & Bio**
  - [ ] Can upload photos from camera roll
  - [ ] Can take photo with camera (permission prompt)
  - [ ] Can reorder photos (drag and drop)
  - [ ] Can delete uploaded photos
  - [ ] Enforces 3-6 photo requirement
  - [ ] Name field validates (not empty)
  - [ ] Age field validates (18+)
  - [ ] Gender selection works
  - [ ] Bio text area works (optional)
  - [ ] Can proceed to next step

- [ ] **Step 3: Questionnaire**
  - [ ] All questions display correctly
  - [ ] Can select answers for all questions
  - [ ] Multi-select questions work
  - [ ] Can skip optional questions
  - [ ] Shows progress indicator
  - [ ] Can complete questionnaire
  - [ ] Shows success confirmation

### Persona Verification (Critical)

- [ ] **Verification Flow**
  - [ ] "Verify My Identity" button works
  - [ ] Opens Persona verification modal
  - [ ] Persona loads successfully
  - [ ] Can complete ID upload
  - [ ] Can complete selfie verification
  - [ ] Receives success confirmation
  - [ ] Can access app after verification
  - [ ] Shows appropriate error if verification fails
  - [ ] Shows pending state during review

---

## 2. Discover & Matching (Critical)

### Discover Screen

- [ ] **Profile Cards**
  - [ ] Profiles load and display correctly
  - [ ] Photos display in carousel
  - [ ] Can swipe through multiple photos
  - [ ] Name and age display correctly
  - [ ] Bio text displays (if present)
  - [ ] Compatibility score displays
  - [ ] Astrological info displays (Sun, Moon, Rising)

- [ ] **Swiping Functionality**
  - [ ] Can swipe left (pass)
  - [ ] Can swipe right (send invite)
  - [ ] Swipe animation is smooth
  - [ ] Next profile loads immediately
  - [ ] Shows loading state when fetching profiles
  - [ ] Shows "no more profiles" message when exhausted

- [ ] **Invite Management**
  - [ ] Daily invite count displays correctly (X/5)
  - [ ] Count decrements when sending invite
  - [ ] Shows paywall when reaching 0 invites
  - [ ] Shows correct invite reset time
  - [ ] Invites reset at midnight (test if possible)

### Match Flow

- [ ] **Creating a Match**
  - [ ] Mutual invites create a match
  - [ ] Push notification sent on match (if enabled)
  - [ ] Match appears in Matches tab
  - [ ] Match card displays correctly
  - [ ] Can tap match to open chat

- [ ] **Match Notifications**
  - [ ] In-app notification shows immediately
  - [ ] Push notification arrives (if enabled)
  - [ ] Tapping notification opens correct match
  - [ ] Notification sound plays (if enabled)

---

## 3. Messaging (Critical)

### Chat Interface

- [ ] **Message Sending**
  - [ ] Can type in message input field
  - [ ] Send button enabled when text present
  - [ ] Message sends successfully
  - [ ] Message appears in chat immediately
  - [ ] Timestamp displays correctly
  - [ ] Can send multiple messages rapidly

- [ ] **Message Receiving**
  - [ ] Receives messages in real-time
  - [ ] Messages display correctly (text, timestamp)
  - [ ] Push notification arrives for new message
  - [ ] Unread badge displays on Matches tab
  - [ ] Unread indicator on specific match

- [ ] **Chat Features**
  - [ ] Can scroll through message history
  - [ ] Messages load when scrolling up (pagination)
  - [ ] Can see match's profile from chat header
  - [ ] Timestamps update correctly (e.g., "Just now", "5 min ago")
  - [ ] Handles long messages (wrapping)
  - [ ] Handles very long conversations (performance)

---

## 4. Profile & Settings

### Own Profile

- [ ] **Profile Display**
  - [ ] All photos display correctly
  - [ ] Can swipe through photos
  - [ ] Name, age, location display
  - [ ] Bio displays
  - [ ] Birth chart info displays
  - [ ] Questionnaire answers visible (if applicable)

- [ ] **Profile Editing**
  - [ ] Tap "Edit Profile" opens editor
  - [ ] Can add/remove/reorder photos
  - [ ] Can update bio text
  - [ ] Can update basic info (name, etc.)
  - [ ] Changes save successfully
  - [ ] Changes reflect immediately in app

### Other User Profiles

- [ ] **Viewing Profiles**
  - [ ] Can view profile from Discover
  - [ ] Can view profile from match card
  - [ ] All profile info displays correctly
  - [ ] Compatibility score shows
  - [ ] Birth chart info shows

### Settings Screen

- [ ] **Account Settings**
  - [ ] Email displays correctly
  - [ ] Subscription status displays
  - [ ] Can sign out successfully
  - [ ] Sign out clears session properly

- [ ] **Notification Settings**
  - [ ] Can toggle push notifications
  - [ ] Can toggle match notifications
  - [ ] Can toggle message notifications
  - [ ] Settings save and persist

- [ ] **Privacy & Legal**
  - [ ] Privacy Policy link works
  - [ ] Terms of Service link works
  - [ ] Can delete account (if implemented)

---

## 5. Premium/Paywall (Critical for Monetization)

### Beta Mode Paywall

- [ ] **Triggering Paywall**
  - [ ] Paywall appears when daily invites exhausted
  - [ ] Can trigger from Discover screen
  - [ ] Modal displays correctly

- [ ] **Paywall Display**
  - [ ] Headline shows: "Get More Swipes"
  - [ ] Subheadline shows invite limits
  - [ ] Feature list displays
  - [ ] "Subscribe Now" button present
  - [ ] Close button (X) present

- [ ] **Beta "Coming Soon" Flow**
  - [ ] Tapping "Subscribe Now" shows Coming Soon modal
  - [ ] Coming Soon modal has correct messaging
  - [ ] Can dismiss Coming Soon modal
  - [ ] Returns to previous screen after dismissal
  - [ ] Analytics tracked (check PostHog)

- [ ] **Non-Beta Production Flow** (Test after enabling payments)
  - [ ] Tapping "Subscribe Now" shows RevenueCat purchase flow
  - [ ] Pricing displays correctly ($9.99/month)
  - [ ] Can complete purchase
  - [ ] Purchase confirmation appears
  - [ ] Premium features unlock immediately
  - [ ] Invite limit increases to 20/day

---

## 6. Push Notifications

### Notification Permissions

- [ ] **Permission Request**
  - [ ] App requests notification permission
  - [ ] Handles "Allow" correctly
  - [ ] Handles "Don't Allow" gracefully
  - [ ] Can re-enable in Settings if denied

### Notification Types

- [ ] **Match Notifications**
  - [ ] Receives notification on new match
  - [ ] Notification has correct text
  - [ ] Tapping opens match chat
  - [ ] Notification sound plays (if enabled)

- [ ] **Message Notifications**
  - [ ] Receives notification on new message
  - [ ] Shows sender name and preview
  - [ ] Tapping opens chat with sender
  - [ ] Multiple messages group correctly

---

## 7. Data Persistence & Sync

### Session Management

- [ ] **Stay Logged In**
  - [ ] User stays logged in after closing app
  - [ ] Session persists after device restart
  - [ ] Session persists for multiple days

- [ ] **Logout**
  - [ ] Sign out clears local data
  - [ ] Redirects to login screen
  - [ ] Cannot access app content when logged out

### Data Sync

- [ ] **Profile Data**
  - [ ] Profile edits sync to server
  - [ ] Profile data loads after reinstall
  - [ ] Profile visible to other users immediately

- [ ] **Match Data**
  - [ ] Matches persist across sessions
  - [ ] Match data stays in sync
  - [ ] No duplicate matches

- [ ] **Message Data**
  - [ ] Messages sync across devices (if testing on multiple)
  - [ ] Message history loads correctly
  - [ ] No duplicate or missing messages

---

## 8. Error Handling & Edge Cases

### Network Errors

- [ ] **Offline Mode**
  - [ ] Shows error message when offline
  - [ ] Graceful handling of network loss
  - [ ] Retries when connection restored
  - [ ] Doesn't crash when offline

- [ ] **API Errors**
  - [ ] Shows user-friendly error messages
  - [ ] Doesn't expose technical details
  - [ ] Provides retry options
  - [ ] Logs errors to Sentry

### Input Validation

- [ ] **Form Validation**
  - [ ] Email format validated
  - [ ] Password strength enforced
  - [ ] Age requirement enforced (18+)
  - [ ] Required fields validated
  - [ ] Shows clear error messages

### App State

- [ ] **Background/Foreground**
  - [ ] App resumes correctly from background
  - [ ] Data refreshes when returning to foreground
  - [ ] No data loss when backgrounded
  - [ ] Push notifications work when backgrounded

- [ ] **App Updates**
  - [ ] Can install new TestFlight build
  - [ ] Data persists after update
  - [ ] No migration issues

---

## 9. Performance & Stability

### App Launch

- [ ] **Cold Start**
  - [ ] App launches in <3 seconds
  - [ ] Splash screen displays
  - [ ] No crashes on launch

- [ ] **Warm Start**
  - [ ] App resumes quickly from background
  - [ ] State restored correctly

### Responsiveness

- [ ] **UI Performance**
  - [ ] Smooth scrolling (Discover, Messages, Matches)
  - [ ] No frame drops during animations
  - [ ] Buttons respond immediately
  - [ ] No UI freezing or hangs

- [ ] **Image Loading**
  - [ ] Profile photos load quickly
  - [ ] Shows loading placeholders
  - [ ] No broken image icons
  - [ ] Images cached for performance

### Memory & Battery

- [ ] **Resource Usage**
  - [ ] App doesn't consume excessive memory
  - [ ] No memory leaks (test extended usage)
  - [ ] Battery drain is reasonable
  - [ ] No device overheating

---

## 10. Security & Privacy

### Certificate Pinning

- [ ] **API Requests**
  - [ ] All API requests succeed
  - [ ] No SSL/TLS errors in logs
  - [ ] Certificate pinning active (check logs)
  - [ ] Supabase requests work
  - [ ] RevenueCat requests work
  - [ ] PostHog requests work

### Data Security

- [ ] **Sensitive Data**
  - [ ] Passwords not visible in logs
  - [ ] API keys not exposed in app
  - [ ] Birth chart data encrypted
  - [ ] Messages encrypted in transit

### Permissions

- [ ] **Camera**
  - [ ] Permission requested when needed
  - [ ] Handles denial gracefully
  - [ ] Can still use app if denied

- [ ] **Photo Library**
  - [ ] Permission requested when needed
  - [ ] Handles denial gracefully
  - [ ] Can still use app if denied

- [ ] **Notifications**
  - [ ] Permission requested appropriately
  - [ ] App works without notifications

---

## 11. Analytics & Monitoring

### Event Tracking (Check PostHog)

- [ ] **User Events**
  - [ ] Sign-up tracked
  - [ ] Sign-in tracked
  - [ ] Profile completed tracked
  - [ ] Persona verification tracked
  - [ ] Invite sent tracked
  - [ ] Match created tracked
  - [ ] Message sent tracked
  - [ ] Paywall shown tracked
  - [ ] Beta purchase attempted tracked

### Error Monitoring (Check Sentry)

- [ ] **Sentry Integration**
  - [ ] Test errors appear in Sentry
  - [ ] User context attached to errors
  - [ ] Device info attached to errors
  - [ ] Breadcrumbs show user actions
  - [ ] No unexpected errors in Sentry

---

## 12. Device & OS Compatibility

### iOS Versions

- [ ] **iOS 15** (if available)
  - [ ] All features work
  - [ ] UI displays correctly
  - [ ] No crashes

- [ ] **iOS 16** (if available)
  - [ ] All features work
  - [ ] UI displays correctly
  - [ ] No crashes

- [ ] **iOS 17+**
  - [ ] All features work
  - [ ] UI displays correctly
  - [ ] No crashes

### Device Sizes

- [ ] **Small (iPhone SE, iPhone 8)**
  - [ ] UI fits screen correctly
  - [ ] Text is readable
  - [ ] Buttons are tappable
  - [ ] No layout overflow

- [ ] **Medium (iPhone 12, 13, 14)**
  - [ ] UI displays correctly
  - [ ] Optimal layout
  - [ ] All features accessible

- [ ] **Large (iPhone 14 Pro Max, 15 Pro Max)**
  - [ ] UI scales appropriately
  - [ ] No excessive white space
  - [ ] Touch targets still work

---

## 13. Accessibility (Nice-to-Have)

### VoiceOver

- [ ] **Screen Reader**
  - [ ] Buttons have accessibility labels
  - [ ] Images have descriptions
  - [ ] Navigation works with VoiceOver

### Dynamic Type

- [ ] **Text Sizing**
  - [ ] App respects system text size
  - [ ] Text remains readable at larger sizes
  - [ ] UI doesn't break with large text

---

## Critical Bugs Checklist

**Before releasing to beta or production, ensure NONE of these exist:**

- [ ] **No crash on app launch**
- [ ] **No crash during sign-up/sign-in**
- [ ] **No crash during profile creation**
- [ ] **No crash during persona verification**
- [ ] **No crash when swiping profiles**
- [ ] **No crash when matching**
- [ ] **No crash when sending messages**
- [ ] **No crash when viewing paywall**
- [ ] **No data loss after app restart**
- [ ] **No inability to sign out**
- [ ] **No stuck loading states**
- [ ] **No complete feature failures**

---

## Sign-Off

### Testing Complete

**Tested By:** _______________
**Date:** _______________
**Build Approved:** [ ] Yes [ ] No

**Critical Issues Found:** _______________
**Non-Critical Issues Found:** _______________

**Notes:**
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________

**Ready for Distribution:** [ ] Yes [ ] No

**If No, Blockers:**
_____________________________________________________________________________
_____________________________________________________________________________

---

## Appendix: Common Test Scenarios

### Scenario 1: New User Full Flow
1. Download app from TestFlight
2. Sign up with email
3. Complete all 3 profile setup steps
4. Complete Persona verification
5. View Discover screen
6. Send 5 invites
7. Trigger paywall
8. Verify Coming Soon modal

### Scenario 2: Matching & Messaging
1. User A sends invite to User B
2. User B sends invite to User A
3. Match created
4. Both receive notifications
5. User A sends message
6. User B receives message
7. User B replies
8. Conversation continues

### Scenario 3: Daily Limit Reset
1. User sends 5 invites
2. Paywall appears
3. Wait until midnight (or manually adjust server time)
4. Invites reset to 5
5. User can send invites again

### Scenario 4: Error Recovery
1. Disable network
2. Try to send message
3. See error message
4. Re-enable network
5. Message sends successfully

---

**Version:** 1.0.0
**Last Updated:** 2025-10-28
**Maintained By:** Stellr QA Team
