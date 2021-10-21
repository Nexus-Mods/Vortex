import ua from "universal-analytics";

class Analytics {
  private user: ua.Visitor;

  constructor() {}

  /**
   * isUserSet
   */
  public isUserSet(): boolean {
    return !!this.user
  }

  /**
   * Sets and Initializes the Universal Analytics tracking
   */
  public setUser(uuidV4) {
    if (!this.user) {
      this.user = ua('UA-210527049-1', uuidV4);
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
    this.user?.event({
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
    const newPath = `/${path.split(' ').join('-').toLowerCase()}`;
    this.user?.pageview(newPath).send()
  }
}

const analytics = new Analytics()

export default analytics