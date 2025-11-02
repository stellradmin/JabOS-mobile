import * as Sentry from '@sentry/react-native';
import { logger } from '../utils/logger';

const STRICT = String(process.env.EXPO_PUBLIC_STRICT_SECURITY || '').toLowerCase() === 'true';

function hasWebCrypto(): boolean {
  try {
    const g: any = globalThis as any;
    return !!(g && g.crypto && g.crypto.subtle);
  } catch {
    return false;
  }
}

export function isStrictSecurity(): boolean {
  return STRICT;
}

export function getSecurityRuntimeStatus() {
  return {
    strict: STRICT,
    webCrypto: hasWebCrypto(),
  };
}

export function initRuntimeSecurity(): void {
  if (STRICT && !hasWebCrypto()) {
    const msg = 'Strict security enabled but WebCrypto is unavailable. Run a development client or production build.';
    logger.error(msg, undefined, {}, 'SECURITY');
    try { Sentry.captureMessage(msg, { level: 'fatal' as any }); } catch {}
    throw new Error('STRICT_SECURITY_REQUIRES_WEBCRYPTO');
  }
  if (!STRICT && !hasWebCrypto()) {
    logger.warn('Running without WebCrypto (Expo Go). Falling back to OS store only.', undefined, {}, 'SECURITY');
  }
}

