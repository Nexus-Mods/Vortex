/**
 * QA-94: free user opens the profile dropdown and clicks "View profile on web",
 * which should open their Nexus Mods profile URL in the system browser.
 */
import { test, expect } from "../fixtures/vortex-app";
import { freeUser } from "../helpers/users";

test.describe("Account - View profile on web", () => {
  test.use({ nexusUser: freeUser });

  test(`[QA-94] free user clicking "View profile on web" opens the profile URL`, async ({
    vortexApp,
    vortexWindow,
  }) => {
    await test.step("Stub shell.openExternal", async () => {
      await vortexApp.evaluate(({ shell }) => {
        const slot = global as unknown as { __capturedOpenUrls?: string[] };
        slot.__capturedOpenUrls = [];
        shell.openExternal = (url: string) => {
          slot.__capturedOpenUrls?.push(url);
          return Promise.resolve();
        };
      });
    });

    await test.step("Open the profile dropdown", async () => {
      const avatar = vortexWindow.locator("button:has(img[alt])").first();
      await avatar.click();
    });

    await test.step("Click 'View profile on web'", async () => {
      const item = vortexWindow.getByText(/view profile on web/i).first();
      await expect(item).toBeVisible();
      await item.click();
    });

    await test.step("Verify the captured URL is a Nexus Mods profile page", async () => {
      const captured = await vortexApp.evaluate(
        () => (global as unknown as { __capturedOpenUrls?: string[] }).__capturedOpenUrls ?? [],
      );
      expect(captured.length).toBeGreaterThan(0);

      const url = new URL(captured[0]!);
      expect(url.hostname).toContain("nexusmods.com");
      expect(url.pathname).toMatch(/^\/users\/\d+$/);
    });
  });
});
