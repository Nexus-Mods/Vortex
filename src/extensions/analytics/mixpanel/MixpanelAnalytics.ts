import Mixpanel from 'mixpanel';
import { MIXPANEL_PROD_TOKEN, MIXPANEL_DEV_TOKEN } from '../constants';
import { getApplication } from '../../../util/application';
import { IValidateKeyDataV2 } from '../../nexus_integration/types/IValidateKeyData';
import { analyticsServiceLog } from '../utils/analyticsLog';
import { MixpanelEvent } from './MixpanelEvents';

class MixpanelAnalytics {

  private mixpanel: Mixpanel.Mixpanel;
  private user: number;
  private superProperties: Record<string, any> = {};

  /**
   * isUserSet returns if the user is set
   */
  public isUserSet(): boolean {
    return !!this.user && !!this.mixpanel;
  }

  /**
   * Sets and Initializes the Mixpanel tracking with super properties
   */
  public start(userInfo: IValidateKeyDataV2, isStable: boolean) {
    this.user = userInfo.userId;
    const token = isStable ? MIXPANEL_PROD_TOKEN : MIXPANEL_DEV_TOKEN;
    const environment = isStable ? 'production' : 'development';
    this.mixpanel = Mixpanel.init(token);

    // Build and store super properties based on data team requirements
    this.superProperties = this.buildSuperProperties(userInfo);

    analyticsServiceLog('mixpanel', 'debug', `Started for ${environment}`, { 
      userId: this.user, 
      isStable,
      environment,
      superProperties: this.superProperties 
    });
  }

  /**
   * Build super properties according to data team specs
   */
  private buildSuperProperties(userInfo: IValidateKeyDataV2) {

    // Identity & Session
    const userType = this.getUserType(userInfo);
    // isModAuthor unavailable
    // isStaff unavailable

    // Subscription
    // premiumStatus unavailable
    // planType unavailable

    // Platform
    const platformType = 'app'; // Always 'app' for Vortex
    const appName = 'Vortex';
    const appVersion = getApplication().version;

    const superProps: Record<string, any> = {

      // Identity & Session
      user_type: userType,
      // isModAuthor unavailable
      // isStaff unavailable

      // Subscription
      // premiumStatus unavailable
      // planType unavailable

      // Platform
      platform_type: platformType,
      app_name: appName,
      app_version: appVersion,
    };

    return superProps;
  }

  /**
   * Determine user type from user info
   */
  private getUserType(userInfo: IValidateKeyDataV2): string {
    if (!userInfo) return 'anonymous'; // unused as always logged in before sending
    if (userInfo.isPremium) return 'premium';
    if (userInfo.isSupporter) return 'supporter';
    return 'registered'; // free
  }

  /**
   * Update super properties (e.g., when game changes)
   */
  public updateSuperProperties(properties: Record<string, any>) {
    if (!this.isUserSet()) return;
    this.superProperties = { ...this.superProperties, ...properties };
  }

  /**
   * Disable tracking
   */
  public stop() {
    this.user = null;
    this.mixpanel = null;
    this.superProperties = {};
  }

  /**
   * Track an event using event instance
   */
  public trackEvent(event: MixpanelEvent) {
    if (!this.isUserSet()) {
      analyticsServiceLog('mixpanel', 'warn', 'trackEvent called but user not set', { eventName: event.eventName });
      return;
    }

    // Merge super properties with event properties
    const eventData = {
      distinct_id: this.user,
      ...this.superProperties,
      ...event.properties,
    };

    analyticsServiceLog('mixpanel', 'debug', 'Event tracked', { eventName: event.eventName, eventData });
    this.mixpanel!.track(event.eventName, eventData);
  }
}

const analyticsMixpanel = new MixpanelAnalytics();

export default analyticsMixpanel;