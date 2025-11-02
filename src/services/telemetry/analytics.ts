import { captureAnalyticsEvent, identifyAnalyticsUser, resetAnalyticsIdentity, trackUserJourney } from '../../lib/posthog-enhanced';

class AnalyticsService {
  private isReady = false;

  public markReady() {
    this.isReady = true;
  }

  public identify(userId: string, properties?: Record<string, any>) {
    if (!this.isReady) return;
    identifyAnalyticsUser(userId, properties);
  }

  public capture(eventName: string, properties?: Record<string, any>) {
    if (!this.isReady) return;
    captureAnalyticsEvent(eventName, properties);
  }

  public screen(screenName: string, properties?: Record<string, any>) {
    if (!this.isReady) return;
    trackUserJourney.screenLoaded(screenName, properties?.load_time ?? 0, properties?.cache_hit ?? false);
    captureAnalyticsEvent('screen_view', {
      screen_name: screenName,
      timestamp: new Date().toISOString(),
      ...properties,
    });
  }

  public reset() {
    resetAnalyticsIdentity();
  }
}

export const analytics = new AnalyticsService();
