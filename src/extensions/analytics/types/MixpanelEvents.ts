/**
 * Interface for all Mixpanel events
 */
export interface MixpanelEvent {
  readonly eventName: string;
  readonly properties: Record<string, any>;
}

/**
 * App launched event - sent when Vortex starts up
 */
export class AppLaunchedEvent implements MixpanelEvent {
  readonly eventName = 'app_launched';
  readonly properties: Record<string, any>;

  constructor(os: string) {
    this.properties = {
      os: os,
    };
  }
}