import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly vortexLoginButton: Locator;
  readonly vortexLoginDialog: Locator;
  readonly oauthUrlField: Locator;
  readonly authLoginHeading: Locator;
  readonly authLoginForm: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitLoginButton: Locator;
  readonly oauthPermissionTitle: Locator;
  readonly authoriseButton: Locator;
  readonly authorisationSuccessTitle: Locator;
  readonly profileButton: Locator;
  readonly loggedInMenuItem: Locator;

  constructor(page: Page) {
    this.page = page;
    this.vortexLoginButton = page.getByRole("button", { name: "Log in" });
    this.vortexLoginDialog = page.locator("#login-dialog");
    this.oauthUrlField = page.locator("#login-dialog input[readonly]").first();
    this.authLoginHeading = page.getByRole("heading", {
      name: /Log in to\s+Nexus Mods/i,
    });
    this.authLoginForm = page.locator("form#new_user");
    this.usernameInput = page.locator("#user_login");
    this.passwordInput = page.locator('input[name="user[password]"]');
    this.submitLoginButton = page.getByRole("button", { name: /log in/i }).first();
    this.oauthPermissionTitle = page.locator("p.oauth__title", {
      hasText: /Vortex\s+would like to:/i,
    });
    this.authoriseButton = page.locator('input[type="submit"][value="Authorise"]').first();
    this.authorisationSuccessTitle = page.locator("p.oauth__title", {
      hasText: /Authorisation successful!/i,
    });
    // Logged in the button is named after the user, so fall back to the avatar image.
    this.profileButton = page
      .getByRole("button", { name: /^(profile|log in)$/i })
      .or(page.locator("button:has(img[alt])"))
      .first();
    this.loggedInMenuItem = page.getByText(/view profile on web|logout/i).first();
  }
}
