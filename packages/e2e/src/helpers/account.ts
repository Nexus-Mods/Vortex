import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures/vortex-app";
import { ProfileMenu } from "../selectors/profileMenu";
import { Timeouts } from "./timeouts";

/**
 * Sign out through the profile menu's Logout item and verify the app is left
 * logged out: the avatar is replaced by the header "Log in" control.
 */
export async function logoutFromVortex(vortexWindow: Page): Promise<void> {
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
}
