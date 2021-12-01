import ua from 'universal-analytics';

class Analytics {
  public user: ua.Visitor;
  public key: { key: string, path: string };
  public uuidV4: string;

  constructor() {
    // Not used right now
  }

  /**
   * isUserSet returs if the user is set
   */
  public isUserSet(): boolean {
    return !!this.user;
  }

  /**
   * Sets and Initializes the Universal Analytics tracking
   */
  public start(uuidV4: string, updateChannel: string, dimensionsPayload: IDimensionsPaylaod) {
    this.key = ANALYTICS_KEYS[updateChannel] ?? ANALYTICS_KEYS.stable;
    this.uuidV4 = uuidV4;
    if (this.key && this.uuidV4) {
      this.user = ua(this.key.key, uuidV4);
      this.user.set('cd1', dimensionsPayload.vortexVersion);
      this.user.set('cd2', dimensionsPayload.gameId);
      this.user.set('cd3', dimensionsPayload.gameVersion);
      this.user.set('cd4', dimensionsPayload.membership);
      this.user.set('cd5', dimensionsPayload.theme);
    }
  }

  public setDimension(dimensionId: DIMENSIONS, dimensionValue) {
    if (!this.isUserSet()) {
      return;
    }
    const dimension = 'cd' + dimensionId;
    this.user.set(dimension, dimensionValue);
  }

  /**
   * Disable tracking for not logged in user and/or opt-out user
   */
  public stop() {
    this.user = null;
  }

  /**
   * generic event tracking function
   */
  public trackEvent(category: string, action: string, label?: string, value?: number) {

    if (!this.isUserSet()) {
      return;
    }
    this.user.event({
      ec: category,
      ea: action,
      el: label,
      ev: value,
    })
      .send();
  }

  /**
   * Generic click event tracking
   */
  public trackClickEvent(category, label?, value?) {
    this.trackEvent(category, 'Click', label, value);
  }

  /**
   * Tracks the navigation the app, EG: Clicking a menu item on the left
   */
  public trackNavigation(path = 'Missing Path') {
    if (!this.isUserSet()) { return; }
    const newPath = `/${path.replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9 /-]/g, '').replaceAll(' ', '-').toLocaleLowerCase()}`;
    this.user.pageview(newPath, this.key.path).send();
  }
}

interface IDimensionsPaylaod {
  vortexVersion: string;
  membership: string;
  gameId: string;
  gameVersion: string;
  theme: string;
}

const ANALYTICS_KEYS = {
  stable: {
    key: 'UA-3620483-22',
    path: 'http://VortexRelease.com',
  },
  beta: {
    key: 'UA-3620483-24',
    path: 'http://vortexbeta.com',
  },
  next: {
    key: 'UA-3620483-23',
    path: 'http://VortexCollections.com',
  },
};

export enum DIMENSIONS {
  VortexVersion = 1,
  Game,
  GameVersion,
  Membership,
}

const analytics = new Analytics();

export default analytics;
