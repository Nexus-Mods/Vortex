/**
 * QA-92 + QA-93: free user must NOT see the header Premium badge;
 * premium user MUST see it. Pure login + header assertion — no website
 * navigation, no game management.
 */
import { test, expect } from "../fixtures/vortex-app";
import { loginToNexus } from "../helpers/login";
import { freeUser, premiumUser, type NexusUser } from "../helpers/users";
import { Header } from "../selectors/header";

const TIERS = [
  {
    id: "QA-92",
    tier: "free",
    user: freeUser,
    expectBadge: false,
  },
  {
    id: "QA-93",
    tier: "premium",
    user: premiumUser,
    expectBadge: true,
  },
] as const satisfies readonly {
  id: string;
  tier: string;
  user: NexusUser;
  expectBadge: boolean;
}[];

test.describe("Account - Header Premium badge", () => {
  test.describe.configure({ mode: "parallel" });

  for (const { id, tier, user, expectBadge } of TIERS) {
    const verb = expectBadge ? "sees" : "does NOT see";
    test(`[${id}] ${tier} user ${verb} the Premium badge in the header`, async ({
      vortexApp,
      vortexWindow,
    }) => {
      test.setTimeout(120_000);

      await loginToNexus(vortexApp, vortexWindow, user);

      const header = new Header(vortexWindow);
      if (expectBadge) {
        await expect(header.premiumIndicator).toBeVisible({ timeout: 15_000 });
        await expect(header.premiumIndicator).toHaveText(/premium/i);
      } else {
        await expect(header.premiumIndicator).toBeHidden({ timeout: 15_000 });
      }
    });
  }
});
