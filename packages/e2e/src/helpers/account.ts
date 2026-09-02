import { expect, type Page } from "@playwright/test";

import { test } from "../fixtures/vortex-app";
import { ProfileMenu } from "../selectors/profileMenu";
import { Timeouts } from "./timeouts";

export async function logoutFromVortex(vortexWindow: Page): Promise<void> {
  const profileMenu = new ProfileMenu(vortexWindow);

  await test.step("The header shows the signed-in avatar", async () => {
    await expect(profileMenu.avatarButton).toBeVisible({ timeout: Timeouts.NETWORK });
  });

  await test.step("Click the avatar to open the account menu", async () => {
    await profileMenu.avatarButton.click();
    await expect(profileMenu.logoutItem).toBeVisible();
  });

  await test.step("Click Logout", async () => {
    await profileMenu.logoutItem.dispatchEvent("click");
    await expect(profileMenu.loginButton).toBeVisible({ timeout: Timeouts.NETWORK });
  });

  await test.step("The avatar is no longer shown in the header", async () => {
    await expect(profileMenu.avatarButton).toBeHidden();
  });
}
