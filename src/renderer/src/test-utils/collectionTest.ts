import type { IModRule } from "../extensions/mod_management/types/IMod";
import type { IProfile } from "../extensions/profile_management/types/IProfile";
import { modRuleId } from "../util/collectionInstallSession";
import { test as driverTest } from "./driverTest";
import type { ICollectionHarness, IDriverHarnessState } from "./harnessTypes";

const GAME_ID = "skyrimse";

export interface ICollectionFixtures {
  // build a collection-scenario harness around the real InstallDriver: install a revision, swap to
  // another (update/downgrade), and read per-member session status
  makeCollection: (overrides?: Partial<IDriverHarnessState>) => ICollectionHarness;
}

/**
 * Test for collection install scenarios. Extends driverTest's makeDriver (the real InstallDriver
 * over the fake api) with a makeCollection factory that drives the real driver.start for
 * install/swap, so revision update/downgrade re-attribution runs through real code.
 */
export const test = driverTest.extend<ICollectionFixtures>({
  makeCollection: async ({ makeDriver }, use) => {
    await use((overrides: Partial<IDriverHarnessState> = {}) => {
      const profile = {
        id: "prof-1",
        gameId: GAME_ID,
        modState: {},
        name: "test",
      } as unknown as IProfile;
      const harness = makeDriver({ profiles: { [profile.id]: profile }, ...overrides });
      let currentRules: IModRule[] = [];
      let currentCollectionId = "";

      const collection: ICollectionHarness = {
        ...harness,
        installRevision: async (rev, present = rev.installed) => {
          harness.setState((draft) => {
            const byId = (draft.persistent.mods[GAME_ID] ??= {});
            byId[rev.collection.id] = rev.collection;
            for (const mod of present) {
              byId[mod.id] = mod;
            }
          });
          currentRules = rev.rules;
          currentCollectionId = rev.collection.id;
          await harness.driver.start(profile, rev.collection);
        },
        completeActiveInstall: async () => {
          // the single-writer install path marks each member installed; mimic that so the
          // completion check passes (no InstallManager in the harness)
          harness.setState((draft) => {
            const session = draft.session.collections.activeSession;
            if (session != null) {
              for (const id of Object.keys(session.mods)) {
                session.mods[id].status = "installed";
              }
            }
          });
          // the driver advances to review once it sees the collection's deps are installed
          harness.emit("did-install-dependencies", GAME_ID, currentCollectionId, false);
          // let the async did-install-dependencies handler settle (it awaits a collection-info
          // lookup that short-circuits without a download), then proceed past review to close
          await new Promise((resolve) => setTimeout(resolve, 0));
          await harness.driver.continue();
        },
        memberStatus: (tag) => {
          const rule = currentRules.find((candidate) => candidate.reference.tag === tag);
          return rule === undefined
            ? undefined
            : harness.getState().session.collections.activeSession?.mods[modRuleId(rule)]?.status;
        },
      };
      return collection;
    });
  },
});
