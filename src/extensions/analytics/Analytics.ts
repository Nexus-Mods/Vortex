import ua from 'universal-analytics';

class Analytics {
  public user: ua.Visitor;

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
  public setUser(uuidV4) {
    if (!this.user) {
      this.user = ua('UA-3620483-23', uuidV4);
    }
  }

  /**
   * Disable tracking for not logged in user and/or opt-out user
   */
  public unsetUser() {
    this.user = null;
  }

  /**
   * generic event tracking function
   */
  public trackEvent(category, action, label?, value?) {
    // tslint:disable-next-line: no-console
    console.log({
      category,
      action,
      label,
    });
    if (!this.isUserSet()) { return; }
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
    const newPath = `/${path.split(' ').join('-').toLowerCase()}`;
    this.user.pageview(newPath, 'https://VortexCollections.com').send();
  }
}

const analytics = new Analytics();

export default analytics;
