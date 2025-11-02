import * as Sentry from '@sentry/react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../../lib/supabase';
import { analytics } from './analytics';
import { logError, logWarn, logDebug } from '../../utils/logger';

export type MonitoringSeverity = 'critical' | 'error' | 'warning';

interface TransactionHandle {
  finish: () => void;
  setData: (key: string, value: unknown) => void;
  span: (name: string, options?: Record<string, unknown>) => { finish: () => void };
}

class MonitoringServiceClass {
  private initialized = false;

  public initialize() {
    this.initialized = true;
    analytics.markReady();
    logDebug('Monitoring service initialized', 'MONITORING');
  }

  public async identify(userId: string, properties?: Record<string, unknown>) {
    analytics.identify(userId, properties);
    try {
      await supabase.from('analytics_events').insert({
        user_id: userId,
        event_name: 'identify',
        event_properties: properties ?? {},
        device_info: await this.getDeviceInfo(),
      });
    } catch (error) {
      logWarn('Failed to persist identify analytics event', 'MONITORING', error);
    }
  }

  public async trackEvent(eventName: string, properties?: Record<string, unknown>, context?: Record<string, unknown>) {
    if (!this.initialized) {
      logWarn(`Monitoring event before initialization: ${eventName}`, 'MONITORING');
    }

    analytics.capture(eventName, properties as Record<string, any> | undefined);

    if (this.shouldPersist(eventName)) {
      try {
        const currentUserId = await this.getCurrentUserId();
        await supabase.from('analytics_events').insert({
          user_id: currentUserId,
          event_name: eventName,
          event_properties: properties ?? {},
          context: context ?? {},
          device_info: await this.getDeviceInfo(),
        });
      } catch (error) {
        logWarn(`Failed to persist analytics event ${eventName}`, 'MONITORING', error);
      }
    }
  }

  public async captureError(error: Error, context?: Record<string, unknown>, severity: MonitoringSeverity = 'error') {
    let sentryEventId: string | undefined;
    try {
      Sentry.withScope((scope) => {
        if (context) {
          scope.setContext('context', context);
        }
        scope.setLevel(severity === 'critical' ? 'fatal' : severity);
        sentryEventId = Sentry.captureException(error);
      });
    } catch (captureError) {
      logError('Failed to send error to Sentry', 'MONITORING', captureError instanceof Error ? captureError : undefined);
    }

    if (severity === 'critical') {
      try {
        const currentUserId = await this.getCurrentUserId();
        await supabase.from('error_logs').insert({
          user_id: currentUserId,
          error_message: error.message,
          error_stack: error.stack,
          sentry_event_id: sentryEventId,
          app_version: await this.getAppVersion(),
          os_version: await this.getOSVersion(),
          severity,
          context: context ?? {},
        });
      } catch (dbError) {
        logError('Failed to persist critical error log', 'MONITORING', dbError instanceof Error ? dbError : undefined);
      }
    }

    return sentryEventId;
  }

  public startTransaction(name: string, operation: string): TransactionHandle {
    // Sentry v7+ uses startSpan API instead of deprecated startTransaction
    // Store span references for manual control
    let activeSpan: ReturnType<typeof Sentry.startInactiveSpan> | null = null;

    try {
      activeSpan = Sentry.startInactiveSpan({
        name,
        op: operation,
      });

      return {
        finish: () => {
          if (activeSpan) {
            activeSpan.end();
          }
        },
        setData: (key: string, value: unknown) => {
          if (activeSpan) {
            // Sentry v7 uses setAttribute instead of setData
            activeSpan.setAttribute(key, value as any);
          }
        },
        span: (spanName: string, options?: Record<string, unknown>) => {
          // Create child span
          const childSpan = Sentry.startInactiveSpan({
            name: spanName,
            op: (options?.op as string) || spanName,
            parentSpan: activeSpan || undefined,
          });

          return {
            finish: () => {
              if (childSpan) {
                childSpan.end();
              }
            },
          };
        },
      };
    } catch (error) {
      // If Sentry is not initialized or disabled, return no-op handle
      logDebug('Sentry span creation failed, returning no-op handle', 'MONITORING');
      return {
        finish: () => {},
        setData: () => {},
        span: () => ({ finish: () => {} }),
      };
    }
  }

  public resetIdentity() {
    analytics.reset();
  }

  private async getCurrentUserId(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.user?.id ?? null;
    } catch (error) {
      logWarn('Failed to retrieve current user id for monitoring', 'MONITORING', error instanceof Error ? error : undefined);
      return null;
    }
  }

  private shouldPersist(eventName: string): boolean {
    const trackedEvents = new Set([
      'match_created',
      'message_sent',
      'profile_completed',
      'profile_viewed',
      'subscription_completed',
      'payment_completed',
      'swipe_right',
      'swipe_left',
      'conversation_start',
      'critical_error',
    ]);
    return trackedEvents.has(eventName);
  }

  private async getDeviceInfo() {
    const netInfo = await NetInfo.fetch();
    return {
      platform: Platform.OS,
      osVersion: Platform.Version,
      model: Device.modelName,
      deviceType: Device.deviceType,
      manufacturer: Device.manufacturer,
      appVersion: await this.getAppVersion(),
      buildNumber: Application.nativeBuildVersion,
      isEmulator: Device.isDevice === false,
      networkType: netInfo.type,
      isConnected: netInfo.isConnected,
    };
  }

  private async getAppVersion() {
    return Application.nativeApplicationVersion ?? 'unknown';
  }

  private async getOSVersion() {
    return `${Platform.OS} ${Platform.Version}`;
  }
}

export const MonitoringService = new MonitoringServiceClass();
