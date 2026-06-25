import type { Locator, Page } from "@playwright/test";

/**
 * Profile section in the header. When logged in it renders an avatar button
 * that opens a dropdown (View profile on web / Refresh / Send feedback /
 * Logout). When logged out it collapses to a plain "Log in" control.
 */
export class ProfileMenu {
  readonly page: Page;
  /** Logged-in trigger: avatar button rendering the user's profile image. */
  readonly avatarButton: Locator;
  /** "Logout" item inside the opened dropdown. */
  readonly logoutItem: Locator;
  /** Logged-out state: the profile button collapses to a "Log in" control. */
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.avatarButton = page.locator("button:has(img[alt])").first();
    this.logoutItem = page.getByRole("menuitem", { name: /logout/i });
    this.loginButton = page.getByRole("button", { name: /log in/i }).first();
  }
}
