/**
 * Login/authentication tests.
 * Covers test cases: #3.1A, #3.3A, #5.5A-#5.7A
 */
import { test, expect } from "../fixtures/vortex-app";
import { Timeouts } from "../helpers/timeouts";
import { freeUser } from "../helpers/users";
import { LoginPage } from "../selectors/loginPage";

test.describe("Login UI", () => {
  test.use({ nexusUser: freeUser });

  test("Login", async ({ vortexWindow }) => {
    const loginPage = new LoginPage(vortexWindow);
    await expect(loginPage.profileButton).toBeVisible({ timeout: Timeouts.NETWORK });
    await loginPage.profileButton.click();
    await expect(loginPage.loggedInMenuItem).toBeVisible({ timeout: Timeouts.NETWORK });
  });
});
