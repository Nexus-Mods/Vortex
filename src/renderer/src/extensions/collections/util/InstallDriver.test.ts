/**
 * Orchestration tests for InstallDriver, driven through the fake-api harness via the
 * driverTest `makeDriver` fixture. The driver is a singleton reacting to a global event bus
 * while mutating a single redux install session, so the tests are grouped by the USER JOURNEY
 * that exercises a given event surface (session lifecycle, premium install, churn, completion
 * decision) rather than by individual handler. Each journey states only the member rule that
 * distinguishes it and reuses the shared builders for everything else.
 *
 * The harness lifecycle (build + start + the worker-global registry/mock teardown) comes from
 * the shared driverTest/harnessTest fixtures, so there is no hand-written afterEach to forget.
 *
 * Skip attribution (premium/automatic and free-user) is no longer the driver's concern - it
 * moved to markCollectionMemberSkipped (see collectionSkip.test.ts).
 */
import { describe, expect, vi } from "vitest";

import {
  type IDriverHarness,
  makeCollectionModInfo,
  makeDownload,
  makeFileListItem,
  makeInstallerChoices,
  makeMod,
  makePatches,
  makeReference,
  makeRule,
} from "../../../test-utils/builders";
import { test as driverTest } from "../../../test-utils/driverTest";
import { modRuleId } from "../../../util/collectionInstallSession";
import type { IDownload } from "../../download_management/types/IDownload";
import type { IMod, IModRule } from "../../mod_management/types/IMod";
import type { IProfile } from "../../profile_management/types/IProfile";
import { MOD_TYPE } from "../constants";
import { applyPatches } from "./binaryPatching";

// applyPatches is a single named collaborator that does binary file patching (fs). Stubbing it
// at that boundary lets the member install-spec path run without touching disk while we still
// assert it is invoked with the rule's patch info.
vi.mock("./binaryPatching", () => ({ applyPatches: vi.fn() }));

const GAME_ID = "skyrimse";

const profile = {
  id: "prof-1",
  gameId: GAME_ID,
  modState: {},
  name: "test",
} as unknown as IProfile;

interface ICollectionFixture {
  collection: IMod;
  download: IDownload;
}

// Compose a collection mod + its finished archive download from the shared builders, deriving
// archiveId / installationPath / localPath from the id so each journey states only its member
// rule. The download's modInfo omits collectionSlug, so initCollectionInfo short-circuits
// instead of hitting the network.
function makeCollectionFixture(opts: {
  id: string;
  rule: IModRule;
  collectionId?: number;
}): ICollectionFixture {
  const { id, rule, collectionId = 1 } = opts;
  const archiveId = `dl-${id}`;
  const collection = makeMod({
    id,
    type: MOD_TYPE,
    archiveId,
    installationPath: `mods/${id}`,
    rules: [rule],
  });
  const download = makeDownload({
    id: archiveId,
    state: "finished",
    localPath: `${id}.7z`,
    modInfo: makeCollectionModInfo({ collectionId, gameId: GAME_ID }),
  });
  return { collection, download };
}

// extend the shared harness test with a driver fixture: build the harness for a collection
// fixture, run start(), and hand back the started harness (registry/mock teardown is inherited)
const test = driverTest.extend<{
  startCollection: (fixture: ICollectionFixture) => Promise<IDriverHarness>;
}>({
  // build the harness via the inherited makeDriver fixture, run start(), and hand back the
  // started harness (the registry/mock teardown is inherited from harnessTest)
  startCollection: async ({ makeDriver }, use) => {
    await use(async (fixture: ICollectionFixture) => {
      const h = makeDriver({
        mods: { [GAME_ID]: { [fixture.collection.id]: fixture.collection } },
        downloads: { [fixture.download.id]: fixture.download },
        profiles: { [profile.id]: profile },
      });
      await h.driver.start(profile, fixture.collection);
      return h;
    });
  },
});

// a tag-identified required member (no description, so a member did-install-mod skips the
// install-spec side-effects, which are covered by the install-spec journey)
const memberRule: IModRule = makeRule({
  type: "requires",
  reference: makeReference({ tag: "mod-a" }),
});
const defaultFixture = makeCollectionFixture({ id: "col-1", rule: memberRule });
const installedMemberMod: IMod = makeMod({
  id: "installed-a",
  attributes: { referenceTag: "mod-a" },
});

describe("InstallDriver session lifecycle", () => {
  test("constructs in the prepare step", ({ makeDriver }) => {
    const h = makeDriver();
    expect(h.driver.step).toBe("prepare");
  });

  test("start() opens an active session that tracks the collection's member rule", async ({
    startCollection,
  }) => {
    const h = await startCollection(defaultFixture);

    const session = h.getState().session.collections.activeSession;
    expect(session).toBeDefined();
    expect(session?.collectionId).toBe("col-1");
    expect(session?.mods[modRuleId(memberRule)]).toBeDefined();
    expect(h.driver.currentSessionId).toBe(session?.sessionId);
  });

  test("refuses to start a second collection while one is still installing", async ({
    startCollection,
  }) => {
    const h = await startCollection(defaultFixture);
    const firstSessionId = h.driver.currentSessionId;

    const other = makeMod({ id: "col-2", type: MOD_TYPE, archiveId: "dl-2" });
    await h.driver.start(profile, other);

    // the active session is still the first collection's; the second start was rejected
    expect(h.driver.currentSessionId).toBe(firstSessionId);
    expect(h.getState().session.collections.activeSession?.collectionId).toBe("col-1");
  });
});

describe("InstallDriver premium install journey", () => {
  test("counts a member mod toward installedMods when it finishes installing", async ({
    startCollection,
  }) => {
    const h = await startCollection(defaultFixture);
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][installedMemberMod.id] = installedMemberMod;
    });

    h.emit("did-install-mod", GAME_ID, defaultFixture.download.id, installedMemberMod.id);

    expect(h.driver.installedMods.map((mod) => mod.id)).toContain(installedMemberMod.id);
  });

  test("is idempotent for a duplicate did-install-mod (counts the member once)", async ({
    startCollection,
  }) => {
    // churn / out-of-order: the same install event can arrive more than once
    const h = await startCollection(defaultFixture);
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][installedMemberMod.id] = installedMemberMod;
    });

    h.emit("did-install-mod", GAME_ID, defaultFixture.download.id, installedMemberMod.id);
    h.emit("did-install-mod", GAME_ID, defaultFixture.download.id, installedMemberMod.id);

    expect(h.driver.installedMods.filter((mod) => mod.id === installedMemberMod.id)).toHaveLength(
      1,
    );
  });

  test("applies the rule's install spec to a member mod when it finishes installing", async ({
    startCollection,
  }) => {
    // a member with a description triggers the side-effect block: the rule's patches /
    // installer choices / file list are applied + stamped onto the installed mod
    const installerChoices = makeInstallerChoices();
    const patches = makePatches();
    const fileList = [makeFileListItem()];
    const sfxRule: IModRule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-sfx", description: "Mod SFX" }),
      installerChoices,
      patches,
      fileList,
    });
    const sfx = makeCollectionFixture({ id: "col-sfx", rule: sfxRule, collectionId: 2 });
    const installedSfxMod = makeMod({
      id: "installed-sfx",
      attributes: { referenceTag: "mod-sfx" },
    });

    const h = await startCollection(sfx);
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][installedSfxMod.id] = installedSfxMod;
    });

    h.emit("did-install-mod", GAME_ID, sfx.download.id, installedSfxMod.id);

    // binary patches applied against the installed mod (applyPatches is stubbed)
    expect(applyPatches).toHaveBeenCalledWith(
      expect.anything(),
      sfx.collection,
      GAME_ID,
      "Mod SFX",
      installedSfxMod.id,
      patches,
    );
    // the install spec is stamped onto the mod (read back through the real mods reducer)
    const installed = h.getState().persistent.mods[GAME_ID][installedSfxMod.id];
    expect(installed.attributes?.installerChoices).toEqual(installerChoices);
    expect(installed.attributes?.patches).toEqual(patches);
    expect(installed.attributes?.fileList).toEqual(fileList);
  });
});

describe("InstallDriver churn (events from non-members / other collections)", () => {
  test("does not let a non-member mod's did-install-mod touch the active install", async ({
    startCollection,
  }) => {
    // a standalone mod (or a different collection's mod) finishing install must not be
    // attributed to the active collection. Use the description-bearing sfx collection so that a
    // mis-attribution WOULD run the install-spec side-effects (a stamped attribute / dispatch),
    // making the "no change" assertions load-bearing rather than vacuous.
    const sfxRule: IModRule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-sfx", description: "Mod SFX" }),
      installerChoices: makeInstallerChoices(),
    });
    const sfx = makeCollectionFixture({ id: "col-sfx", rule: sfxRule, collectionId: 2 });
    const h = await startCollection(sfx);
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID]["foreign"] = makeMod({
        id: "foreign",
        attributes: { referenceTag: "not-a-member" },
      });
    });
    const dispatchedBefore = h.dispatched.length;

    h.emit("did-install-mod", GAME_ID, sfx.download.id, "foreign");

    expect(h.driver.installedMods).toHaveLength(0);
    expect(h.dispatched.length).toBe(dispatchedBefore);
    expect(h.getState().persistent.mods[GAME_ID]["foreign"].attributes?.installerChoices).toBe(
      undefined,
    );
  });
});

describe("InstallDriver completion decision", () => {
  // isInstallComplete is the completion DECISION, split out of onDidInstallDependencies so it
  // is testable without the postprocessing side-effect (staging path / readCollection). The
  // collection reaches review only when this returns true.

  test("reports complete once every required member is installed", async ({ startCollection }) => {
    const h = await startCollection(defaultFixture);
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][installedMemberMod.id] = installedMemberMod;
    });

    expect(h.driver.isInstallComplete(false)).toBe(true);
  });

  test("reports incomplete while a required member is still missing", async ({
    startCollection,
  }) => {
    const h = await startCollection(defaultFixture);

    expect(h.driver.isInstallComplete(false)).toBe(false);
  });

  test("treats an ignored required member as resolved", async ({ startCollection }) => {
    // a member that was skipped (durable ignored flag) must not block completion, even though
    // it was never installed - otherwise a skipped required mod leaves the collection stuck
    const ignoredRule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-ign" }),
      ignored: true,
    });
    const h = await startCollection(makeCollectionFixture({ id: "col-ign", rule: ignoredRule }));

    expect(h.driver.isInstallComplete(false)).toBe(true);
  });
});
