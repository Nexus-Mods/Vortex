/**
 * QA-97: a logged-in user can sign out via the profile menu's Logout item.
 * After logout the app returns to a logged-out state (the avatar is gone and a
 * "Log in" control is shown).
 */
import { test, expect } from "../fixtures/vortex-app";
import { Timeouts } from "../helpers/timeouts";
import { freeUser } from "../helpers/users";
import { ProfileMenu } from "../selectors/profileMenu";

test.describe("Account - Sign out", () => {
  test.use({ nexusUser: freeUser });

  test("[QA-97] logged-in user can sign out via the profile menu", async ({ vortexWindow }) => {
    const profileMenu = new ProfileMenu(vortexWindow);

    await test.step("Open the profile dropdown", async () => {
      await expect(profileMenu.avatarButton).toBeVisible({ timeout: Timeouts.NETWORK });
      await profileMenu.avatarButton.click();
      await expect(profileMenu.logoutItem).toBeVisible();
    });

    await test.step("Click Logout", async () => {
      await profileMenu.logoutItem.dispatchEvent("click");
      await expect(profileMenu.loginButton).toBeVisible({ timeout: Timeouts.NETWORK });
    });

    await test.step("Verify the avatar is no longer shown", async () => {
      await expect(profileMenu.avatarButton).toBeHidden();
    });
  });
});
