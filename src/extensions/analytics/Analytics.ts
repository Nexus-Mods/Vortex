import ua from 'universal-analytics';

class Analytics {
  private mUser: ua.Visitor;

  constructor() {
    // Not used right now
  }

  /**
   * isUserSet returs if the user is set
   */
  public isUserSet(): boolean {
    return !!this.mUser;
  }

  /**
   * Sets and Initializes the Universal Analytics tracking
   */
  public setUser(uuidV4) {
    if (!this.mUser) {
      this.mUser = ua('UA-3620483-23', uuidV4);
    }
  }

  /**
   * Disable tracking for not logged in user and/or opt-out user
   */
  public unsetUser() {
    this.mUser = null;
  }

  /**
   * generic event tracking function
   */
  public trackEvent(category, action, label?, value?) {
    if (!this.isUserSet()) { return; }
    this.mUser.event({
      ec: category,
      ea: action,
      el: label,
      ev: value,
    })
    .send();
  }

  /**
   * Tracks the navigation the app, EG: Clicking a menu item on the left
   */
  public trackNavigation(path = 'Missing Path') {
    if (!this.isUserSet()) { return; }
    const newPath = `/${path.split(' ').join('-').toLowerCase()}`;
    this.mUser.pageview(newPath, 'https://VortexCollections.com').send();
  }
}

const analytics = new Analytics();

export default analytics;
