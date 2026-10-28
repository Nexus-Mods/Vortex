import { describe, expect, vi } from "vitest";

import { makeMod, makeReference, makeRule, managerInternals } from "../../test-utils/builders";
import { test as imTest } from "../../test-utils/installManagerTest";
import { MOD_TYPE } from "../collections/constants";

vi.mock("../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});

const GAME = "skyrimse";
const COLLECTION = "col-1";

const memberRules = [0, 1, 2].map((member) =>
  makeRule({
    type: "requires",
    reference: makeReference({ tag: `tag-${member}`, fileMD5: `md5-${member}` }),
  }),
);
const dependencies = memberRules.map((rule, member) => ({
  reference: rule.reference,
  mod: { id: `mod-${member}` },
  lookupResults: [],
}));

const collectionWith = (rules = memberRules) => ({
  mods: { [GAME]: { [COLLECTION]: makeMod({ id: COLLECTION, type: MOD_TYPE, rules }) } },
});

describe("updateRules", () => {
  imTest(
    "updates every changed member rule in one store update",
    async ({ makeInstallManager }) => {
      const harness = makeInstallManager(collectionWith());
      let storeUpdates = 0;
      harness.api.store.subscribe(() => {
        storeUpdates += 1;
      });

      await managerInternals(harness.manager).updateRules(
        harness.api,
        GAME,
        COLLECTION,
        dependencies,
        true,
      );

      expect(storeUpdates).toBe(1);
      expect(harness.dispatched.map((action) => action.type)).toEqual(["MOD_RULES_REPLACED"]);
      expect(harness.getState().persistent.mods[GAME][COLLECTION].rules).toEqual(
        memberRules.map((rule, member) => ({
          ...rule,
          type: "recommends",
          reference: { ...rule.reference, idHint: `mod-${member}` },
        })),
      );
    },
  );

  imTest("leaves the store alone when no member rule changed", async ({ makeInstallManager }) => {
    const harness = makeInstallManager(collectionWith());
    let storeUpdates = 0;
    harness.api.store.subscribe(() => {
      storeUpdates += 1;
    });

    await managerInternals(harness.manager).updateRules(
      harness.api,
      GAME,
      COLLECTION,
      dependencies,
      false,
    );

    expect(storeUpdates).toBe(0);
    expect(harness.getState().persistent.mods[GAME][COLLECTION].rules).toEqual(memberRules);
  });
});
