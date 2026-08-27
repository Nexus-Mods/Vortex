import type { Locator, Page } from "@playwright/test";

/**
 * Profile section in the header. When logged in it renders an avatar button that
 * opens a menu (View profile on web / Refresh / Help / Logout), where Help opens a
 * submenu beside it. When logged out the avatar is replaced by a help-only button
 * and the "Log in" control moves to the premium slot alongside it.
 */
export class ProfileMenu {
  readonly page: Page;
  /**
   * Logged-in trigger: the avatar button. Matched on its test id rather than its
   * image, since the spine's game buttons carry one too and render first, and the
   * avatar falls back to an icon when the profile image doesn't load.
   */
  readonly avatarButton: Locator;
  /** "Logout" item inside the opened menu. */
  readonly logoutItem: Locator;
  /** Logged-out state: the "Log in" control shown in place of the premium indicator. */
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.avatarButton = page.getByTestId("profile-menu-trigger");
    this.logoutItem = page.getByRole("menuitem", { name: /logout/i });
    this.loginButton = page.getByRole("button", { name: /log in/i }).first();
  }
}
