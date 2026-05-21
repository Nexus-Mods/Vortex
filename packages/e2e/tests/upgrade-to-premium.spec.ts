/**
 * QA-96: free user clicks the Dashboard "Go Premium" button and is taken to
 * the premium upgrade URL.
 */
import { test, expect } from "../fixtures/vortex-app";
import { loginToNexus } from "../helpers/login";
import { freeUser } from "../helpers/users";
import { NavBar } from "../selectors/navbar";

test.describe("Account - Upgrade to Premium", () => {
  test(`[QA-96] free user clicking Go Premium opens the upgrade URL`, async ({
    vortexApp,
    vortexWindow,
  }) => {
    test.setTimeout(120_000);

    await loginToNexus(vortexApp, vortexWindow, freeUser);

    await test.step("Wait for userInfo and force Dashboard re-render", async () => {
      await vortexWindow.keyboard.press("Escape").catch(() => undefined);
      const headerGoPremium = vortexWindow.getByRole("button", { name: /Go premium/i }).first();
      await expect(headerGoPremium).toBeVisible({ timeout: 60_000 });

      const navbar = new NavBar(vortexWindow);
      await navbar.gamesLink.click();
      await navbar.homeLink.click();
    });

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

    await test.step("Click the Go Premium dashlet button", async () => {
      const goPremiumBtn = vortexWindow.locator(".dashlet-premium-button");
      await expect(goPremiumBtn).toBeVisible({ timeout: 30_000 });
      await goPremiumBtn.click();
    });

    await test.step("Verify the captured URL points to the premium page", async () => {
      const captured = await vortexApp.evaluate(
        () => (global as unknown as { __capturedOpenUrls?: string[] }).__capturedOpenUrls ?? [],
      );
      expect(captured.length).toBeGreaterThan(0);

      const url = new URL(captured[0]!);
      expect(url.hostname).toContain("nexusmods.com");
      expect(url.pathname).toContain("account/billing/premium");
      expect(url.searchParams.get("utm_source")).toBe("vortex");
      expect(url.searchParams.get("utm_campaign")).toBeTruthy();
    });
  });
});
