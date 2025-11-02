# Certificate Pinning Rotation Procedure

## ⚠️ CRITICAL SECURITY PROCESS

This document outlines the procedure for rotating SSL certificate pins to prevent app breakage when server certificates expire.

## Current Certificate Pins

Last Updated: **2025-10-28**

| Hostname | Leaf Pin | CA Pin | Expiry Date | Status |
|----------|----------|--------|-------------|--------|
| `bodiwrrbjpfuvepnpnsv.supabase.co` | `o7y2J41zMtHgAsZJDXeU13tHTo2m4Br+9xBR8RdSCvY=` | `kIdp6NNEd8wsugYyyIYFsi1ylMCED3hZbSR8ZFsa/A4=` | 2025-12-31 | ⚠️ Expires Soon |
| `api.revenuecat.com` | `VGu0zIfFg4zoRk4uXxKdd2GIJfdT+Xgb1mNQo/12Ijs=` | `lyXQLG/81tHkNq6AspMb9zMj2vhe29x5k/iuxJHpsms=` | 2026-01-31 | ✅ Active |
| `eu.posthog.com` | `qcxyjH3ChjgfK4MDhMi6saL+xWPI+Yv5UTZplJMwQdE=` | `vxRon/El5KuI4vx5ey1DgmsYmRY0nDd5Cg4GfJ8S+bg=` | 2026-02-28 | ✅ Active |

## Certificate Rotation Schedule

### Quarterly Health Check (Every 3 Months)
1. **Review Expiry Dates**: Check all certificate expiry dates
2. **Monitor Logs**: Review certificate pinning logs for failures
3. **Plan Rotations**: Schedule rotations for certificates expiring in <90 days

### Annual Rotation (Once Per Year)
Even if certificates haven't expired, rotate pins annually as a security best practice.

## Rotation Procedure

### Prerequisites
- [ ] OpenSSL installed (`brew install openssl` on macOS)
- [ ] Access to production deployment pipeline
- [ ] TestFlight beta testing capability
- [ ] 30+ days before certificate expiry

### Step 1: Extract New Certificate Pins (30 Days Before Expiry)

```bash
# Extract leaf certificate pin
echo | openssl s_client -connect <hostname>:443 -servername <hostname> 2>/dev/null | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | base64

# Extract CA certificate pin (issuer)
echo | openssl s_client -showcerts -connect <hostname>:443 -servername <hostname> 2>/dev/null | \
  awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/{if(/BEGIN CERTIFICATE/){a++}; if(a==2)print}' | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | base64
```

### Step 2: Update Certificate Pins

Edit `src/utils/certificate-pinning.ts`:

```typescript
const CERTIFICATE_PINS: CertificatePin[] = [
  {
    hostname: 'bodiwrrbjpfuvepnpnsv.supabase.co',
    leafPin: 'sha256/NEW_PIN_HERE=',
    caPin: 'sha256/NEW_CA_PIN_HERE=',
    validUntil: 'YYYY-MM-DD',
  },
  // ... other hosts
];
```

### Step 3: Update This Document

Update the table above with:
- New pins
- New expiry dates
- Today's date as "Last Updated"

### Step 4: Test Locally

```bash
# Run type check
npm run type-check

# Build development client
eas build --profile development --platform ios

# Test on device
# Verify API calls work correctly with new pins
```

### Step 5: Deploy to Beta (TestFlight)

```bash
# Create preview build with new pins
eas build --profile preview --platform ios

# Submit to TestFlight
eas submit --platform ios

# Monitor beta tester feedback for 7-14 days
```

### Step 6: Production Deployment

```bash
# Create production build
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios

# Wait 30 days for user adoption (check analytics)
```

### Step 7: Server Certificate Rotation (Safe After 30 Days)

**IMPORTANT**: Only rotate server certificates AFTER:
- App with new pins is live in App Store
- 95%+ of users have updated to new app version
- 30+ days have passed since production release

## Emergency Rotation (Certificate Expired Unexpectedly)

If a certificate expires without proper rotation:

1. **Immediate Action**: Deploy hotfix with both old + new pins
2. **Expedited Review**: Request expedited App Store review
3. **User Communication**: Notify users to update immediately
4. **Post-Mortem**: Document what went wrong and how to prevent

## Monitoring & Alerts

### Set Up Monitoring

1. **Sentry Alerts**: Certificate pinning failures trigger Sentry errors
2. **Analytics Dashboard**: Track certificate expiry warnings
3. **Calendar Reminders**: Set reminders 90, 60, 30 days before expiry

### Check Logs Regularly

```typescript
// Logs appear as:
"Certificate pin for {hostname} expires soon ({validUntil})" // Warning (30 days)
"Certificate pin for {hostname} has EXPIRED!" // Error (post-expiry)
```

## Troubleshooting

### Pin Mismatch Error

```
SSL Certificate validation failed for {hostname}.
Potential man-in-the-middle attack detected. Connection refused.
```

**Causes**:
1. Certificate rotated on server without app update
2. Incorrect pin extracted
3. Network proxy/VPN intercepting traffic
4. Actual MITM attack

**Resolution**:
1. Verify server certificate hasn't changed
2. Re-extract pins and compare
3. Test on different network
4. Check Sentry for error patterns

### App Can't Connect After Update

**Likely Cause**: Old pins still in app, server certificate already rotated

**Immediate Fix**:
1. Roll back server certificate (if possible)
2. Deploy hotfix with correct pins
3. Expedite App Store review

**Prevention**: Always deploy app BEFORE rotating server certificates

## Security Best Practices

1. **Pin Both Leaf + CA**: Provides redundancy during rotation
2. **Never Skip Rotation**: Expired certificates break the app completely
3. **Test Thoroughly**: Test on real devices, not just simulators
4. **Monitor Proactively**: Set up alerts 90 days before expiry
5. **Document Everything**: Update this file with every rotation

## References

- Certificate Pinning Code: `src/utils/certificate-pinning.ts`
- react-native-ssl-pinning: https://github.com/MaxToyberman/react-native-ssl-pinning
- OpenSSL Docs: https://www.openssl.org/docs/
- Let's Encrypt Lifecycle: https://letsencrypt.org/docs/cert-lifecycle/

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-28 | Claude Code | Initial creation with REAL certificate pins |

---

**CRITICAL REMINDER**: Failure to rotate certificates on time will cause complete app outage for ALL users. Set calendar reminders NOW!
