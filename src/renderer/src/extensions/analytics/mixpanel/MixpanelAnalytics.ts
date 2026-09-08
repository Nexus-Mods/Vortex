import { getErrorMessageOrDefault } from "@vortex/shared";
import mixpanel from "mixpanel-browser";

import { getApplication } from "../../../util/application";
import type {
  IMembership,
  IValidateKeyDataV2,
} from "../../nexus_integration/types/IValidateKeyData";
import { MIXPANEL_PROD_TOKEN, MIXPANEL_DEV_TOKEN } from "../constants";
import { analyticsServiceLog } from "../utils/analyticsLog";
import type { MixpanelEvent } from "./MixpanelEvents";

/**
 * Events emitted before analytics has started (consent given, user known) are
 * held here and sent once it does. Early startup work such as the auto-updater
 * runs before login restores, so without this its events would be lost, not
 * merely late. Bounded; oldest dropped first. Cleared on stop(), so nothing
 * captured before a "No" ever leaves the machine.
 */
const MAX_PENDING_EVENTS = 50;

class MixpanelAnalytics {
  private user: number;
  private isInitialized: boolean = false;
  private pending: MixpanelEvent[] = [];

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
      analyticsServiceLog("mixpanel", "warn", "start() called but already initialized", {
        userId: this.user,
        newUserId: userInfo.userId,
      });
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
      api_host: "https://api.nexusmods.com/events",
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

    this.flushPending();
  }

  private flushPending() {
    if (this.pending.length === 0) {
      return;
    }
    const queued = this.pending;
    this.pending = [];
    analyticsServiceLog("mixpanel", "debug", "Sending events queued before start", {
      count: queued.length,
    });
    for (const event of queued) {
      this.trackEvent(event);
    }
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
  private getUserType(userInfo: IMembership): string {
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
   * Register (or clear) the active-game super properties so every subsequent event
   * carries game/profile scope without each event having to pass it. Pass `null` when
   * no game is active (e.g. the games dashboard) so stale scope can't leak onto
   * game-agnostic events. `game_id` is the numeric Nexus id; `profile_id` is the active
   * profile's id.
   */
  public setGameContext(context: { gameId: number | null; profileId: string } | null) {
    if (!this.isUserSet()) return;
    if (context === null) {
      mixpanel.unregister("game_id");
      mixpanel.unregister("profile_id");
      analyticsServiceLog("mixpanel", "debug", "Game context cleared");
      return;
    }
    if (context.gameId === null) {
      // Unresolved id (games cache still loading): keep the persisted game_id; the caller retries.
      mixpanel.register({ profile_id: context.profileId });
      analyticsServiceLog("mixpanel", "debug", "Game context deferred (games cache not loaded)", {
        kept_game_id: this.registeredGameId(),
        profile_id: context.profileId,
      });
      return;
    }
    mixpanel.register({
      game_id: context.gameId,
      profile_id: context.profileId,
    });
    analyticsServiceLog("mixpanel", "debug", "Game context registered", {
      game_id: context.gameId,
      profile_id: context.profileId,
    });
  }

  /** The game_id super property as mixpanel will send it — including a value persisted from a previous session. */
  private registeredGameId(): number | null {
    return (mixpanel.get_property("game_id") as number | undefined) ?? null;
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
    this.pending = [];
  }

  /**
   * Track an event using event instance
   */
  public trackEvent(event: MixpanelEvent) {
    if (!this.isUserSet()) {
      // Not started yet: either analytics is off (opted out, or not asked yet)
      // or login has not restored. Queue it; start() sends the queue, stop()
      // drops it.
      this.pending.push(event);
      if (this.pending.length > MAX_PENDING_EVENTS) {
        this.pending.shift();
      }
      analyticsServiceLog("mixpanel", "debug", "Event queued (analytics not started)", {
        eventName: event.eventName,
        queued: this.pending.length,
      });
      return;
    }

    // Track event with mixpanel-browser
    // Super properties are automatically included
    // IP address and geolocation are automatically tracked
    mixpanel.track(event.eventName, event.properties);

    analyticsServiceLog("mixpanel", "debug", "Event tracked", {
      eventName: event.eventName,
      game_id: this.registeredGameId(),
      properties: event.properties,
    });
  }
}

const analyticsMixpanel = new MixpanelAnalytics();

export default analyticsMixpanel;
