import { vi } from "vitest";

import { NxmProtocol } from "../extensions/nexus_integration/nxmProtocol";
import { makeNxmHarness, makeUserInfo } from "./builders";
import { test as harnessTest } from "./harnessTest";
import type { IDriverHarnessState, INxmHarness } from "./harnessTypes";

/** A mod file on a real game, with no authorisation from the website. */
export const MOD_URL = "nxm://skyrimspecialedition/mods/100/files/500";
export const COLLECTION_URL = "nxm://skyrimspecialedition/collections/abcdef/revisions/3";

export const PREMIUM = makeUserInfo({ name: "premium-user" });
export const FREE = makeUserInfo({ name: "free-user", isPremium: false });

export interface INxmSetup {
  harness: INxmHarness;
  nxm: NxmProtocol;
  /** `nxm.resolve`, the download protocol handler under test. */
  resolve: NxmProtocol["resolve"];
  /** The membership re-read the site asks for with an nxm://premium link. */
  onRefreshMembership: ReturnType<typeof vi.fn>;
}

export interface INxmFixtures {
  // build the real NxmProtocol over a seeded harness; defaults to a premium account
  makeNxm: (overrides?: Partial<IDriverHarnessState>) => INxmSetup;
}

/**
 * Base test for the nxm protocol suites. The handler keeps its download queue and awaited links
 * on the instance, so each call gets a fresh one and no suite has to drain state between tests.
 *
 * Each suite declares its own `vi.mock` for the modules that reach the network (`./util`), because
 * mock factories are hoisted per file and can't live here.
 */
export const test = harnessTest.extend<INxmFixtures>({
  makeNxm: async ({ task: _task }, use) => {
    await use((overrides: Partial<IDriverHarnessState> = {}) => {
      const harness = makeNxmHarness({ userInfo: PREMIUM, ...overrides });
      const onRefreshMembership = vi.fn();
      const nxm = new NxmProtocol(harness.api, () => harness.nexus, { onRefreshMembership });
      return { harness, nxm, resolve: nxm.resolve, onRefreshMembership };
    });
  },
});
