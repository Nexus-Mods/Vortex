/**
 * Orchestration tests for InstallDriver, driven through the fake-api harness
 * (test-utils/builders makeDriverHarness). The driver is a singleton reacting to a global
 * event bus while mutating a single redux install session, so the tests are grouped by the
 * USER JOURNEY that exercises a given event surface (session lifecycle, premium install,
 * churn, completion decision) rather than by individual handler. Each journey states only the
 * member rule that distinguishes it and reuses the shared builders for everything else.
 *
 * Skip attribution (premium/automatic and free-user) is no longer the driver's concern - it
 * moved to markCollectionMemberSkipped (see collectionSkip.test.ts).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  makeCollectionModInfo,
  makeDownload,
  makeDriverHarness,
  makeFileListItem,
  makeInstallerChoices,
  makeMod,
  makePatches,
  makeReference,
  makeRule,
  resetHarnessRegistries,
} from "../../../test-utils/builders";
import { modRuleId } from "../../../util/collectionInstallSession";
import type { IDownload } from "../../download_management/types/IDownload";
import type { IMod, IModRule } from "../../mod_management/types/IMod";
import type { IProfile } from "../../profile_management/types/IProfile";
import { MOD_TYPE } from "../constants";
import { applyPatches } from "./binaryPatching";
import InstallDriver from "./InstallDriver";

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

function harnessFor(fixture: ICollectionFixture) {
  return makeDriverHarness(InstallDriver, {
    mods: { [GAME_ID]: { [fixture.collection.id]: fixture.collection } },
    downloads: { [fixture.download.id]: fixture.download },
    profiles: { [profile.id]: profile },
  });
}

// Build the harness and run start(profile, collection), returning the started harness.
async function started(fixture: ICollectionFixture) {
  const h = harnessFor(fixture);
  await h.driver.start(profile, fixture.collection);
  return h;
}

afterEach(() => {
  resetHarnessRegistries();
  vi.clearAllMocks();
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
  it("constructs in the prepare step", () => {
    const h = makeDriverHarness(InstallDriver);
    expect(h.driver.step).toBe("prepare");
  });

  it("start() opens an active session that tracks the collection's member rule", async () => {
    const h = await started(defaultFixture);

    const session = h.getState().session.collections.activeSession;
    expect(session).toBeDefined();
    expect(session?.collectionId).toBe("col-1");
    expect(session?.mods[modRuleId(memberRule)]).toBeDefined();
    expect(h.driver.currentSessionId).toBe(session?.sessionId);
  });

  it("refuses to start a second collection while one is still installing", async () => {
    const h = await started(defaultFixture);
    const firstSessionId = h.driver.currentSessionId;

    const other = makeMod({ id: "col-2", type: MOD_TYPE, archiveId: "dl-2" });
    await h.driver.start(profile, other);

    // the active session is still the first collection's; the second start was rejected
    expect(h.driver.currentSessionId).toBe(firstSessionId);
    expect(h.getState().session.collections.activeSession?.collectionId).toBe("col-1");
  });
});

describe("InstallDriver premium install journey", () => {
  it("counts a member mod toward installedMods when it finishes installing", async () => {
    const h = await started(defaultFixture);
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][installedMemberMod.id] = installedMemberMod;
    });

    h.emit("did-install-mod", GAME_ID, defaultFixture.download.id, installedMemberMod.id);

    expect(h.driver.installedMods.map((mod) => mod.id)).toContain(installedMemberMod.id);
  });

  it("is idempotent for a duplicate did-install-mod (counts the member once)", async () => {
    // churn / out-of-order: the same install event can arrive more than once
    const h = await started(defaultFixture);
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][installedMemberMod.id] = installedMemberMod;
    });

    h.emit("did-install-mod", GAME_ID, defaultFixture.download.id, installedMemberMod.id);
    h.emit("did-install-mod", GAME_ID, defaultFixture.download.id, installedMemberMod.id);

    expect(h.driver.installedMods.filter((mod) => mod.id === installedMemberMod.id)).toHaveLength(
      1,
    );
  });

  it("applies the rule's install spec to a member mod when it finishes installing", async () => {
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

    const h = await started(sfx);
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
  it("does not let a non-member mod's did-install-mod touch the active install", async () => {
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
    const h = await started(sfx);
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

  it("reports complete once every required member is installed", async () => {
    const h = await started(defaultFixture);
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][installedMemberMod.id] = installedMemberMod;
    });

    expect(h.driver.isInstallComplete(false)).toBe(true);
  });

  it("reports incomplete while a required member is still missing", async () => {
    const h = await started(defaultFixture);

    expect(h.driver.isInstallComplete(false)).toBe(false);
  });

  it("treats an ignored required member as resolved", async () => {
    // a member that was skipped (durable ignored flag) must not block completion, even though
    // it was never installed - otherwise a skipped required mod leaves the collection stuck
    const ignoredRule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-ign" }),
      ignored: true,
    });
    const h = await started(makeCollectionFixture({ id: "col-ign", rule: ignoredRule }));

    expect(h.driver.isInstallComplete(false)).toBe(true);
  });
});
