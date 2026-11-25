/**
 * A collection installed into a profile where some of its optional members are already installed
 * (by another profile, or an earlier revision of the collection). The members the player selected
 * have to end up enabled in that profile: the dependency gather only covers required rules and the
 * optional phase only drives members that still need a download, so without a dedicated step they
 * count as installed while staying disabled. Regression cover for CMTY-395.
 */
import { describe, expect, vi } from "vitest";

import {
  makeMod,
  makeProfile,
  makeReference,
  makeRule,
  managerInternals as internals,
} from "../../test-utils/builders";
import type { IDriverHarnessState, IInstallManagerHarness } from "../../test-utils/harnessTypes";
import { test as imTest } from "../../test-utils/installManagerTest";
import type { IModRule } from "./types/IMod";

vi.mock("../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});

const GAME = "skyrimse";
const OLD_PROFILE = "prof-old";
const NEW_PROFILE = "prof-new";
const COLLECTION = "col-1";

const requiredRule = makeRule({
  type: "requires",
  reference: makeReference({ tag: "req-a", gameId: GAME }),
});

// what installRecommended persists once the player accepts the optionals
const selectedOptional = makeRule({
  type: "recommends",
  reference: makeReference({ tag: "opt-a", gameId: GAME }),
  ignored: false,
});

function installedMod(id: string, tag: string, archiveId = `dl-${id}`) {
  return makeMod({ id, archiveId, attributes: { referenceTag: tag } });
}

function setup(
  makeInstallManager: (overrides?: Partial<IDriverHarnessState>) => IInstallManagerHarness,
  opts: {
    rules?: IModRule[];
    extraMods?: ReturnType<typeof makeMod>[];
    newProfileEnabled?: string[];
    collectionType?: string;
  } = {},
) {
  const {
    rules = [requiredRule, selectedOptional],
    extraMods = [],
    newProfileEnabled = [],
    collectionType = "collection",
  } = opts;
  const mods = [
    installedMod("inst-req-a", "req-a"),
    installedMod("inst-opt-a", "opt-a"),
    ...extraMods,
  ];
  const enabledIn = (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, { enabled: true, enabledTime: 0 }]));

  const h = makeInstallManager({
    profiles: {
      // the profile the collection was first installed to, where the optional was accepted
      [OLD_PROFILE]: makeProfile({
        id: OLD_PROFILE,
        gameId: GAME,
        modState: enabledIn(mods.map((mod) => mod.id)),
      }),
      // the profile it is being installed to now
      [NEW_PROFILE]: makeProfile({
        id: NEW_PROFILE,
        gameId: GAME,
        modState: enabledIn(newProfileEnabled),
      }),
    },
    mods: {
      [GAME]: {
        [COLLECTION]: makeMod({ id: COLLECTION, type: collectionType, rules }),
        ...Object.fromEntries(mods.map((mod) => [mod.id, mod])),
      },
    },
  });

  const run = () =>
    internals(h.manager).enableInstalledSelectedOptionals(
      h.api,
      h.getState().persistent.profiles[NEW_PROFILE],
      GAME,
      h.getState().persistent.mods[GAME][COLLECTION],
    );

  const enableActions = () =>
    h.dispatched
      .filter((action) => action.type === "SET_MOD_ENABLED")
      .map((action) => action.payload);

  return { h, run, enableActions };
}

describe("enabling installed optional collection members in the target profile", () => {
  imTest(
    "a selected optional installed by another profile is enabled in the new one",
    async ({ makeInstallManager }) => {
      const { run, enableActions } = setup(makeInstallManager);

      run();

      expect(enableActions()).toEqual([
        { profileId: NEW_PROFILE, modId: "inst-opt-a", enable: true },
      ]);
    },
  );

  imTest("required members are left to the dependency install", async ({ makeInstallManager }) => {
    const { run, enableActions } = setup(makeInstallManager, { rules: [requiredRule] });

    run();

    expect(enableActions()).toEqual([]);
  });

  imTest("an undecided or skipped optional is not enabled", async ({ makeInstallManager }) => {
    const undecided = makeRule({ ...selectedOptional, ignored: undefined });
    const skipped = makeRule({
      type: "recommends",
      reference: makeReference({ tag: "opt-b", gameId: GAME }),
      ignored: true,
    });
    const { run, enableActions } = setup(makeInstallManager, {
      rules: [requiredRule, undecided, skipped],
      extraMods: [installedMod("inst-opt-b", "opt-b")],
    });

    run();

    expect(enableActions()).toEqual([]);
  });

  imTest(
    "an optional already enabled in the profile dispatches nothing",
    async ({ makeInstallManager }) => {
      const { run, enableActions } = setup(makeInstallManager, {
        newProfileEnabled: ["inst-opt-a"],
      });

      run();

      expect(enableActions()).toEqual([]);
    },
  );

  imTest(
    "a selected optional that is not installed is left to the optional phase",
    async ({ makeInstallManager }) => {
      const notInstalled = makeRule({
        type: "recommends",
        reference: makeReference({ tag: "opt-missing", gameId: GAME }),
        ignored: false,
      });
      const { run, enableActions } = setup(makeInstallManager, {
        rules: [requiredRule, notInstalled],
      });

      run();

      expect(enableActions()).toEqual([]);
    },
  );

  imTest(
    "an enabled variant of the same archive is disabled in that profile only",
    async ({ makeInstallManager }) => {
      // another install of the optional's archive, e.g. with different installer options
      const variant = makeMod({
        id: "inst-opt-a+variant",
        archiveId: "dl-inst-opt-a",
        attributes: { referenceTag: "other" },
      });
      const { run, enableActions } = setup(makeInstallManager, {
        extraMods: [variant],
        newProfileEnabled: [variant.id],
      });

      run();

      expect(enableActions()).toEqual([
        { profileId: NEW_PROFILE, modId: variant.id, enable: false },
        { profileId: NEW_PROFILE, modId: "inst-opt-a", enable: true },
      ]);
    },
  );

  imTest(
    "the recommendations of an ordinary mod are never auto-enabled",
    async ({ makeInstallManager }) => {
      const { run, enableActions } = setup(makeInstallManager, { collectionType: "" });

      run();

      expect(enableActions()).toEqual([]);
    },
  );

  imTest("installDependencies runs the step for a collection", async ({ makeInstallManager }) => {
    const { h, enableActions } = setup(makeInstallManager);
    const mgr = internals(h.manager);
    // keep the dependency pipeline itself out of this test
    vi.spyOn(mgr, "installDependenciesImpl").mockResolvedValue(undefined);

    await h.manager.installDependencies(
      h.api as never,
      h.getState().persistent.profiles[NEW_PROFILE],
      GAME,
      COLLECTION,
      true,
    );

    expect(enableActions()).toContainEqual({
      profileId: NEW_PROFILE,
      modId: "inst-opt-a",
      enable: true,
    });
  });
});
