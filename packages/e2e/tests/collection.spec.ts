import { test, expect } from "../fixtures/vortex-app";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const TEST_NEXUS_USERNAME = "NXMMember";
const TEST_NEXUS_PASSWORD = "3BC1mwMZthxi";

test.describe("Collections", () => {
  test('"Download a collection', async ({ vortexApp, vortexWindow }) => {
    let loginPage: Page | null = null;
    let authBrowser: Browser | null = null;
    let authContext: BrowserContext | null = null;
    let authPage: Page | null = null;

    await test.step("Verify dashboard has loaded", async () => {
      const bodyText = await vortexWindow.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    });
    await test.step("Click the login button", async () => {
      const loginBtn = vortexWindow.getByRole("button", { name: "Log in" });
      const popupPromise = vortexWindow
        .waitForEvent("popup", { timeout: 5000 })
        .catch(() => null);
      const appWindowPromise = vortexApp
        .waitForEvent("window", { timeout: 5000 })
        .catch(() => null);

      await expect(loginBtn).toBeVisible();
      await loginBtn.click();

      loginPage = (await popupPromise) ?? (await appWindowPromise);
    });
    await test.step("Verify the browser has opened to the login page", async () => {
      const oauthUrlField = vortexWindow
        .locator("#login-dialog input[readonly]")
        .first();

      await expect(oauthUrlField).toBeVisible({ timeout: 10000 });

      const oauthUrl = await oauthUrlField.inputValue();
      expect(oauthUrl).toMatch(/^https?:\/\//i);

      if (loginPage !== null) {
        await loginPage.waitForLoadState("domcontentloaded");
        await expect(loginPage).toHaveURL(/nexusmods|users\./i);
      }

      // Fresh browser state each run: open a brand-new Chrome context.
      authBrowser = await chromium.launch({
        channel: "chrome",
        headless: false,
      });
      authContext = await authBrowser.newContext();
      authPage = await authContext.newPage();

      await authPage.goto(oauthUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await expect(authPage).toHaveURL(/nexusmods|users\./i);

      const loginHeading = authPage.getByRole("heading", {
        name: /Log in to\s+Nexus Mods/i,
      });
      await expect(loginHeading).toBeVisible({ timeout: 20000 });
    });

    await test.step("Keep auth browser open for next login steps", async () => {
      expect(authBrowser).not.toBeNull();
      expect(authContext).not.toBeNull();
      expect(authPage).not.toBeNull();
    });

    await test.step("Login with test credentials", async () => {
      expect(authPage).not.toBeNull();
      if (authPage === null) {
        throw new Error("Auth page was not available for login.");
      }

      const loginForm = authPage.locator("form#new_user");
      const usernameInput = authPage
        .locator(
          '#user_login, input[name="user[login]"], input[autocomplete="email"]',
        )
        .first();
      const passwordInput = authPage
        .locator(
          '#password, input[name="user[password]"], input[type="password"]',
        )
        .first();

      await expect(loginForm).toBeVisible({ timeout: 20000 });
      await expect(usernameInput).toBeVisible({ timeout: 20000 });
      await expect(passwordInput).toBeVisible({ timeout: 20000 });

      await usernameInput.fill(TEST_NEXUS_USERNAME);
      await passwordInput.fill(TEST_NEXUS_PASSWORD);

      await authPage
        .getByRole("button", { name: /log in/i })
        .first()
        .click();
    });
  });
});
