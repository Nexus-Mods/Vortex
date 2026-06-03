/**
 * QA-92 + QA-93: free user must NOT see the header Premium badge;
 * premium user MUST see it. Pure login + header assertion — no website
 * navigation, no game management.
 */
import { test, expect, type NexusUser } from "../fixtures/vortex-app";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
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
  for (const { id, tier, user, expectBadge } of TIERS) {
    test.describe(tier, () => {
      test.use({ nexusUser: user });

      const verb = expectBadge ? "sees" : "does NOT see";
      test(`[${id}] ${tier} user ${verb} the Premium badge in the header`, async ({
        vortexWindow,
      }) => {
        const header = new Header(vortexWindow);
        if (expectBadge) {
          await expect(header.premiumIndicator).toBeVisible({ timeout: Timeouts.NETWORK });
          await expect(header.premiumIndicator).toHaveText(/premium/i);
        } else {
          await expect(header.premiumIndicator).toBeHidden({ timeout: Timeouts.NETWORK });
        }
      });
    });
  }
});
