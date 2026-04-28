import {
  chromium,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";

import { test } from "../fixtures/vortex-app";
import { LoginPage } from "../selectors/loginPage";

const TEST_NEXUS_USERNAME = "NXMMember";
const TEST_NEXUS_PASSWORD = "3BC1mwMZthxi";

export async function loginToNexus(
  vortexApp: ElectronApplication,
  vortexWindow: Page,
): Promise<void> {
  let loginPage: Page | null = null;
  let authBrowser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let authPage: Page | null = null;

  const vortexLoginPage = new LoginPage(vortexWindow);

  await test.step("Verify dashboard has loaded", async () => {
    const bodyText = await vortexWindow.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  await test.step("Click the login button", async () => {
    const popupPromise = vortexWindow
      .waitForEvent("popup", { timeout: 5000 })
      .catch(() => null);
    const appWindowPromise = vortexApp
      .waitForEvent("window", { timeout: 5000 })
      .catch(() => null);

    await expect(vortexLoginPage.vortexLoginButton).toBeVisible();
    await vortexLoginPage.vortexLoginButton.click();

    loginPage = (await popupPromise) ?? (await appWindowPromise);
  });

  await test.step("Verify the browser has opened to the login page", async () => {
    await expect(vortexLoginPage.oauthUrlField).toBeVisible({ timeout: 10000 });

    const oauthUrl = await vortexLoginPage.oauthUrlField.inputValue();
    expect(oauthUrl).toMatch(/^https?:\/\//i);

    if (loginPage !== null) {
      await loginPage.waitForLoadState("domcontentloaded");
      await expect(loginPage).toHaveURL(/nexusmods|users\./i);
    }

    authBrowser = await chromium.launch({
      channel: "chrome",
      headless: false,
    });
    const authContext = await authBrowser.newContext();
    authPage = await authContext.newPage();

    await authPage.goto(oauthUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await expect(authPage).toHaveURL(/nexusmods|users\./i);

    const nexusLoginPage = new LoginPage(authPage);
    await expect(nexusLoginPage.authLoginHeading).toBeVisible({
      timeout: 20000,
    });
  });

  await test.step("Login with test credentials", async () => {
    if (authPage === null) {
      throw new Error("Auth page was not available for login.");
    }

    const nexusLoginPage = new LoginPage(authPage);

    await expect(nexusLoginPage.authLoginForm).toBeVisible({ timeout: 20000 });
    await expect(nexusLoginPage.usernameInput).toBeVisible({ timeout: 20000 });
    await expect(nexusLoginPage.passwordInput).toBeVisible({ timeout: 20000 });

    await nexusLoginPage.usernameInput.fill(TEST_NEXUS_USERNAME);
    await nexusLoginPage.passwordInput.fill(TEST_NEXUS_PASSWORD);
    await nexusLoginPage.submitLoginButton.click();

    await expect(nexusLoginPage.oauthPermissionTitle).toContainText(
      /Vortex\s+would like to:/i,
      { timeout: 30000 },
    );
    await expect(nexusLoginPage.oauthPermissionTitle).toBeVisible({
      timeout: 30000,
    });
  });

  await test.step("Click Authorise", async () => {
    if (authPage === null) {
      throw new Error("Auth page was not available for authorisation.");
    }

    const nexusLoginPage = new LoginPage(authPage);

    await expect(nexusLoginPage.authoriseButton).toBeVisible({
      timeout: 30000,
    });
    await nexusLoginPage.authoriseButton.click();

    await expect(nexusLoginPage.authorisationSuccessTitle).toContainText(
      /Authorisation successful!/i,
      { timeout: 30000 },
    );
    await expect(nexusLoginPage.authorisationSuccessTitle).toBeVisible({
      timeout: 30000,
    });

    if (authBrowser !== null) {
      await authBrowser.close();
    }
    authBrowser = null;
    authPage = null;
  });

  await test.step("Verify logged in state in Vortex", async () => {
    const vortexLoginPage = new LoginPage(vortexWindow);

    const bodyText = await vortexWindow.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    await vortexWindow.bringToFront();

    if (
      await vortexLoginPage.vortexLoginDialog
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await vortexWindow.keyboard.press("Escape").catch(() => undefined);
    }

    await expect(vortexLoginPage.vortexLoginDialog).toBeHidden({
      timeout: 60000,
    });
    await expect(vortexLoginPage.profileButton).toBeVisible({ timeout: 60000 });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await vortexLoginPage.profileButton.click({ timeout: 10000 });
        break;
      } catch (error) {
        if (attempt === 2) {
          throw error;
        }
      }
    }

    await expect(vortexLoginPage.loggedInMenuItem).toBeVisible({
      timeout: 60000,
    });
  });
}
