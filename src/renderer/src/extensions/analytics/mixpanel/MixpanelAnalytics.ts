import mixpanel from "mixpanel-browser";
import { MIXPANEL_PROD_TOKEN, MIXPANEL_DEV_TOKEN } from "../constants";
import { getApplication } from "../../../util/application";
import type { IValidateKeyDataV2 } from "../../nexus_integration/types/IValidateKeyData";
import { analyticsServiceLog } from "../utils/analyticsLog";
import type { MixpanelEvent } from "./MixpanelEvents";
import { getErrorMessageOrDefault } from "@vortex/shared";

class MixpanelAnalytics {
  private user: number;
  private isInitialized: boolean = false;

  /**
   * isUserSet returns if the user is set
   */
  public isUserSet(): boolean {
    return !!this.user && this.isInitialized;
  }

  /**
   * Sets and Initializes the Mixpanel tracking with super properties
   */
  public start(userInfo: IValidateKeyDataV2, isProduction: boolean) {
    // Guard against multiple initialization
    if (this.isInitialized) {
      analyticsServiceLog(
        "mixpanel",
        "warn",
        "start() called but already initialized",
        {
          userId: this.user,
          newUserId: userInfo.userId,
        },
      );
      return;
    }

    this.user = userInfo.userId;
    const token = isProduction ? MIXPANEL_PROD_TOKEN : MIXPANEL_DEV_TOKEN;
    const environment = isProduction ? "production" : "development";

    // Initialize mixpanel-browser with config
    mixpanel.init(token, {
      debug: false, // Disable internal Mixpanel logging (we use our own analyticsServiceLog)
      track_pageview: false, // We're not a web page
      persistence: "localStorage",
      api_host: "https://api-eu.mixpanel.com",
      // IP and geolocation are automatically tracked by mixpanel-browser
    });

    this.isInitialized = true;

    // Identify the user
    mixpanel.identify(this.user.toString());

    // Build and register super properties
    const superProperties = this.buildSuperProperties(userInfo);
    mixpanel.register(superProperties);

    analyticsServiceLog("mixpanel", "debug", `Started for ${environment}`, {
      userId: this.user,
      isProduction,
      environment,
      superProperties,
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
    const platformType = "app"; // Always 'app' for Vortex
    const appName = "Vortex";
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
    if (!userInfo) return "anonymous"; // unused as always logged in before sending
    if (userInfo.isPremium) return "premium";
    if (userInfo.isSupporter) return "supporter";
    return "registered"; // free
  }

  /**
   * Update super properties (e.g., when game changes)
   */
  public updateSuperProperties(properties: Record<string, any>) {
    if (!this.isUserSet()) return;
    mixpanel.register(properties);
  }

  /**
   * Disable tracking
   */
  public stop() {
    if (this.isInitialized) {
      try {
        mixpanel.reset(); // Clears user identity and super properties
      } catch (err) {
        analyticsServiceLog("mixpanel", "warn", "Failed to reset mixpanel", {
          error: getErrorMessageOrDefault(err),
        });
      }
    }
    this.user = null;
    this.isInitialized = false;
  }

  /**
   * Track an event using event instance
   */
  public trackEvent(event: MixpanelEvent) {
    if (!this.isUserSet()) {
      // Silently ignore when analytics is disabled (user opted out)
      // This is expected behavior, not an error condition
      analyticsServiceLog(
        "mixpanel",
        "debug",
        "Event not tracked (analytics disabled)",
        { eventName: event.eventName },
      );
      return;
    }

    // Track event with mixpanel-browser
    // Super properties are automatically included
    // IP address and geolocation are automatically tracked
    mixpanel.track(event.eventName, event.properties);

    analyticsServiceLog("mixpanel", "debug", "Event tracked", {
      eventName: event.eventName,
      properties: event.properties,
    });
  }
}

const analyticsMixpanel = new MixpanelAnalytics();

export default analyticsMixpanel;
