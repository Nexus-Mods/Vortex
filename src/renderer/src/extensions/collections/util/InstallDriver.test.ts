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
import type { IDriverHarness } from "../../../test-utils/harnessTypes";
import type { CollectionModStatus } from "../../../types/collections/ICollectionInstallSession";
import { modRuleId } from "../../../util/collectionInstallSession";
import type { IDownload } from "../../download_management/types/IDownload";
import { setPendingPluginSort } from "../../mod_management/actions/transactions";
import type { IMod, IModRule } from "../../mod_management/types/IMod";
import type { IProfile } from "../../profile_management/types/IProfile";
import { MOD_TYPE } from "../constants";
import { applyPatches } from "./binaryPatching";
import { deterministicReferenceTag } from "./deterministicReferenceTag";

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
// archiveId / installationPath / localPath from the id. A real collection carries many member
// rules, so buildCollectionFixture takes the full rule set and the churn journeys exercise that
// scale. The download's modInfo omits collectionSlug, so initCollectionInfo short-circuits
// instead of hitting the network.
function buildCollectionFixture(
  id: string,
  rules: IModRule[],
  collectionId = 1,
): ICollectionFixture {
  const archiveId = `dl-${id}`;
  const collection = makeMod({
    id,
    type: MOD_TYPE,
    archiveId,
    installationPath: `mods/${id}`,
    rules,
  });
  const download = makeDownload({
    id: archiveId,
    state: "finished",
    localPath: `${id}.7z`,
    modInfo: makeCollectionModInfo({ collectionId, gameId: GAME_ID }),
  });
  return { collection, download };
}

// thin single-rule helper for the focused lifecycle/premium/completion tests that isolate one
// member; the churn journeys below call buildCollectionFixture with a full member set instead.
function makeCollectionFixture(opts: {
  id: string;
  rule: IModRule;
  collectionId?: number;
}): ICollectionFixture {
  return buildCollectionFixture(opts.id, [opts.rule], opts.collectionId);
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

// Drive the SESSION's per-member terminal status - the single source of truth that
// isInstallComplete now reads (keyed by modRuleId, matching how start() builds the session).
function setSessionStatus(h: IDriverHarness, rules: IModRule[], status: CollectionModStatus): void {
  h.setState((draft) => {
    const session = draft.session.collections.activeSession;
    for (const rule of rules) {
      session.mods[modRuleId(rule)].status = status;
    }
  });
}

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

  test("start() marks the profile as needing a post-install plugin sort", async ({
    startCollection,
  }) => {
    const h = await startCollection(defaultFixture);

    // the durable "sort owed" marker is the safety net that re-sorts after an interrupted install;
    // it is set as soon as the install begins, keyed by profile and collection.
    const markerType = setPendingPluginSort(profile.id, "col-1", 0).type;
    const marker = h.dispatched.find((action) => action.type === markerType);
    expect(marker).toBeDefined();
    expect(marker?.payload).toMatchObject({ profileId: profile.id, collectionId: "col-1" });
    expect(typeof (marker?.payload as { time: unknown }).time).toBe("number");
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

  test("attributes a member matched by reference identity when it has no referenceTag (fallback)", async ({
    startCollection,
  }) => {
    // a mod with no stamped referenceTag misses the O(1) tag index, so it must still be attributed
    // via the reference/identifier fallback (here the rule's logicalFileName)
    const lfnRule = makeRule({
      type: "requires",
      reference: makeReference({ logicalFileName: "ModA.zip" }),
    });
    const fixture = makeCollectionFixture({ id: "col-lfn", rule: lfnRule });
    const h = await startCollection(fixture);
    const installed = makeMod({ id: "installed-lfn", attributes: { logicalFileName: "ModA.zip" } });
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][installed.id] = installed;
    });

    h.emit("did-install-mod", GAME_ID, fixture.download.id, installed.id);

    expect(h.driver.installedMods.map((mod) => mod.id)).toContain(installed.id);
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
    // the member's reference carries a display name (reference.description), so the spec is
    // stamped onto the installed mod AND applyPatches runs (it labels the mod by that name)
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

  test("stamps the install spec even when the member's reference has no display name", async ({
    startCollection,
  }) => {
    // the spec stamping must NOT be gated on reference.description: a member whose reference has no
    // display name still needs its spec stamped so findModByRef(+spec) can re-match it on a later
    // pass. Only applyPatches (which uses the display name as the mod label) stays gated on it.
    const installerChoices = makeInstallerChoices();
    const patches = makePatches();
    const fileList = [makeFileListItem()];
    const rule: IModRule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-nodesc" }), // no reference.description
      installerChoices,
      patches,
      fileList,
    });
    const fixture = makeCollectionFixture({ id: "col-nodesc", rule, collectionId: 3 });
    const installed = makeMod({
      id: "installed-nodesc",
      attributes: { referenceTag: "mod-nodesc" },
    });

    const h = await startCollection(fixture);
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][installed.id] = installed;
    });

    h.emit("did-install-mod", GAME_ID, fixture.download.id, installed.id);

    const stamped = h.getState().persistent.mods[GAME_ID][installed.id];
    expect(stamped.attributes?.installerChoices).toEqual(installerChoices);
    expect(stamped.attributes?.patches).toEqual(patches);
    expect(stamped.attributes?.fileList).toEqual(fileList);
    // no display name -> applyPatches (which labels by it) is skipped
    expect(applyPatches).not.toHaveBeenCalled();
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
  // isInstallComplete is the completion DECISION, split out of onDidInstallDependencies so it is
  // testable without the postprocessing side-effect (staging path / readCollection). It reads the
  // collection SESSION's per-member terminal status (the single source of truth) rather than
  // re-deriving from persistent.mods, so a member counts as resolved once its session status is
  // terminal: installed, failed, or ignored. The collection reaches review only when this is true.

  test("reports complete once every required member reaches a terminal status", async ({
    startCollection,
  }) => {
    const h = await startCollection(defaultFixture);
    setSessionStatus(h, [memberRule], "installed");

    expect(h.driver.isInstallComplete(false)).toBe(true);
  });

  test("reports incomplete while a required member is still pending", async ({
    startCollection,
  }) => {
    // freshly started: the member sits at a non-terminal status (pending), so not complete
    const h = await startCollection(defaultFixture);

    expect(h.driver.isInstallComplete(false)).toBe(false);
  });

  test("treats an ignored required member as resolved", async ({ startCollection }) => {
    // a member skipped via the durable ignored flag reconstructs to session status "ignored",
    // which is terminal - a skipped required mod must not leave the collection stuck
    const ignoredRule = makeRule({
      type: "requires",
      reference: makeReference({ tag: "mod-ign" }),
      ignored: true,
    });
    const h = await startCollection(makeCollectionFixture({ id: "col-ign", rule: ignoredRule }));

    expect(h.driver.isInstallComplete(false)).toBe(true);
  });

  test("treats a failed required member as terminal so completion is not blocked", async ({
    startCollection,
  }) => {
    // A failed required mod COUNTS toward completion rather than blocking it (no stuck-at-9X%).
    // This is safe because InstallManager only writes "failed" after retries are exhausted: while
    // retries remain it re-queues the install without writing "failed", so the member keeps a
    // non-terminal status and still blocks. "failed" therefore means decided-not-pending, and is
    // still revertible if the user manually retries (failed is unprotected -> flips back).
    const h = await startCollection(defaultFixture);
    setSessionStatus(h, [memberRule], "failed");

    expect(h.driver.isInstallComplete(false)).toBe(true);
  });
});

// Build `count` required members with stable tags (member-0 .. member-(count-1)) and the matching
// installed mods. referenceTag is the identity the driver matches a finished install against, so
// each rule/mod pair shares a tag; installed mods default to state "installed" (makeMod default).
function makeMemberSet(count: number, prefix = "member"): { rules: IModRule[]; installed: IMod[] } {
  const rules: IModRule[] = [];
  const installed: IMod[] = [];
  for (let i = 0; i < count; i += 1) {
    const tag = `${prefix}-${i}`;
    rules.push(makeRule({ type: "requires", reference: makeReference({ tag }) }));
    installed.push(makeMod({ id: `inst-${tag}`, attributes: { referenceTag: tag } }));
  }
  return { rules, installed };
}

// deterministic non-sequential ordering (front/back interleave) so a passing assertion can't be an
// artifact of events arriving in member-declaration order
function interleaved<T>(items: T[]): T[] {
  const out: T[] = [];
  let lo = 0;
  let hi = items.length - 1;
  while (lo <= hi) {
    out.push(items[lo]);
    if (lo !== hi) {
      out.push(items[hi]);
    }
    lo += 1;
    hi -= 1;
  }
  return out;
}

// Real collections run into the thousands of members; the churn/perf issues only surface at that
// scale (the field reports were 2000-4000 mods). Default to 2000 and allow CI/local stress runs to
// crank it higher via COLLECTION_CHURN_MEMBERS without editing the test.
const MEMBER_COUNT = Number(process.env.COLLECTION_CHURN_MEMBERS) || 2000;
const { rules: memberRules, installed: memberMods } = makeMemberSet(MEMBER_COUNT);
const bigCollection = buildCollectionFixture("col-big", memberRules);

// startBig builds on the startCollection fixture: start the big collection (no members in state
// yet, so start() tracks every rule as pending), then seed the given member mods into persistent
// state and hand back the started harness. Defaults to seeding all members.
const churnTest = test.extend<{
  startBig: (present?: IMod[]) => Promise<IDriverHarness>;
}>({
  startBig: async ({ startCollection }, use) => {
    await use(async (present: IMod[] = memberMods) => {
      const h = await startCollection(bigCollection);
      h.setState((draft) => {
        for (const mod of present) {
          draft.persistent.mods[GAME_ID][mod.id] = mod;
        }
      });
      return h;
    });
  },
});

describe("InstallDriver churn (large collection, concurrent member installs)", () => {
  churnTest(
    "counts every required member exactly once as installs finish out of order",
    async ({ startBig }) => {
      const h = await startBig();

      for (const mod of interleaved(memberMods)) {
        h.emit("did-install-mod", GAME_ID, bigCollection.download.id, mod.id);
      }

      expect(h.driver.installedMods).toHaveLength(MEMBER_COUNT);
      expect(new Set(h.driver.installedMods.map((mod) => mod.id)).size).toBe(MEMBER_COUNT);
    },
  );

  churnTest(
    "duplicate did-install-mod events for members never double-count",
    async ({ startBig }) => {
      const h = await startBig();

      for (const mod of memberMods) {
        h.emit("did-install-mod", GAME_ID, bigCollection.download.id, mod.id);
      }
      // replay a scattered subset; repeated/out-of-order events are normal under 5-installer churn
      for (const mod of [memberMods[0], memberMods[63], memberMods[MEMBER_COUNT - 1]]) {
        h.emit("did-install-mod", GAME_ID, bigCollection.download.id, mod.id);
      }

      expect(h.driver.installedMods).toHaveLength(MEMBER_COUNT);
    },
  );

  churnTest(
    "isInstallComplete stays false until the final required member is terminal (at scale)",
    async ({ startCollection }) => {
      // completion reads the session, so this is O(members) even at 2000-4000. Mark all-but-last
      // terminal, confirm still incomplete, then the last and confirm it flips.
      const h = await startCollection(bigCollection);
      setSessionStatus(h, memberRules.slice(0, MEMBER_COUNT - 1), "installed");
      expect(h.driver.isInstallComplete(false)).toBe(false);

      setSessionStatus(h, [memberRules[MEMBER_COUNT - 1]], "installed");
      expect(h.driver.isInstallComplete(false)).toBe(true);
    },
  );
});

describe("InstallDriver churn (multiple collections in one setup)", () => {
  // collection A is the active install; collection B is a different collection whose member mods
  // also exist in state and fire install events on the same global bus. Only membership in the
  // ACTIVE session's rules causes attribution - B's member must never be counted toward A.
  const aMembers = makeMemberSet(2, "a");
  const collectionA = buildCollectionFixture("col-a", aMembers.rules, 1);
  const bMemberMod = makeMod({ id: "inst-b-0", attributes: { referenceTag: "b-0" } });

  test("counts only the active collection's members under interleaved cross-collection events", async ({
    startCollection,
  }) => {
    const h = await startCollection(collectionA);
    h.setState((draft) => {
      for (const mod of aMembers.installed) {
        draft.persistent.mods[GAME_ID][mod.id] = mod;
      }
      draft.persistent.mods[GAME_ID][bMemberMod.id] = bMemberMod;
    });

    // interleave A and B install events; only A's two members belong to the active session
    h.emit("did-install-mod", GAME_ID, collectionA.download.id, aMembers.installed[0].id);
    h.emit("did-install-mod", GAME_ID, "dl-col-b", bMemberMod.id);
    h.emit("did-install-mod", GAME_ID, collectionA.download.id, aMembers.installed[1].id);

    expect(h.driver.installedMods.map((mod) => mod.id).sort()).toEqual(["inst-a-0", "inst-a-1"]);
  });
});

describe("InstallDriver churn (out-of-order / pre-state events)", () => {
  const members = makeMemberSet(3, "ooo");
  const collection = buildCollectionFixture("col-ooo", members.rules);

  test("a did-install-mod before the mod exists in state is a safe no-op, counted on re-emit", async ({
    startCollection,
  }) => {
    const h = await startCollection(collection);
    const target = members.installed[1];

    // event arrives before the install record is written to persistent.mods
    h.emit("did-install-mod", GAME_ID, collection.download.id, target.id);
    expect(h.driver.installedMods).toHaveLength(0);

    // the mod lands in state and the event is re-delivered: now counted, exactly once
    h.setState((draft) => {
      draft.persistent.mods[GAME_ID][target.id] = target;
    });
    h.emit("did-install-mod", GAME_ID, collection.download.id, target.id);
    h.emit("did-install-mod", GAME_ID, collection.download.id, target.id);
    expect(h.driver.installedMods.map((mod) => mod.id)).toEqual([target.id]);
  });
});

describe("InstallDriver journey: re-attribution of an already-installed member", () => {
  // Re-attributing an installed member to its rule on (re)start does NOT hinge on the referenceTag.
  // The tag is a fast-path identity confirmation - ideal, and stable when deterministic - but a
  // member is equally matched by its file identity (repo / fileMD5) plus its install spec
  // (modMatchesInstallSpec). That fallback is what keeps the hundreds of thousands of existing
  // random-tag collections re-attributable even though their tags drift on re-processing. The one
  // hard requirement is that the install spec is actually present on the installed mod, which is
  // why the driver now stamps it unconditionally (not only for members carrying a description).
  const reference = makeReference({ fileMD5: "file-abc", tag: undefined });
  const installSpec = { patches: makePatches() };
  const tag = deterministicReferenceTag(reference, installSpec);
  const rule = makeRule({ type: "requires", reference: { ...reference, tag }, ...installSpec });
  const fixture = makeCollectionFixture({ id: "col-reattach", rule });

  test("re-attributes via a matching referenceTag fast-path", async ({ makeDriver }) => {
    const installed = makeMod({
      id: "m-tag",
      attributes: { referenceTag: tag, fileMD5: "file-abc", patches: makePatches() },
    });
    const h = makeDriver({
      mods: {
        [GAME_ID]: { [fixture.collection.id]: fixture.collection, [installed.id]: installed },
      },
      downloads: { [fixture.download.id]: fixture.download },
      profiles: { [profile.id]: profile },
    });

    await h.driver.start(profile, fixture.collection);

    expect(h.driver.isInstallComplete(false)).toBe(true);
  });

  test("re-attributes by fileMD5 + install spec even when the referenceTag has drifted", async ({
    makeDriver,
  }) => {
    // installed earlier but now carrying a DIFFERENT (drifted/old random) tag; identity (fileMD5)
    // plus the stamped spec still resolve it - the path that keeps legacy collections working
    const installed = makeMod({
      id: "m-drift",
      attributes: { referenceTag: "old-random-tag", fileMD5: "file-abc", patches: makePatches() },
    });
    const h = makeDriver({
      mods: {
        [GAME_ID]: { [fixture.collection.id]: fixture.collection, [installed.id]: installed },
      },
      downloads: { [fixture.download.id]: fixture.download },
      profiles: { [profile.id]: profile },
    });

    await h.driver.start(profile, fixture.collection);

    expect(h.driver.isInstallComplete(false)).toBe(true);
  });

  test("does not re-attribute when the install spec was never stamped on the mod", async ({
    makeDriver,
  }) => {
    // matching tag AND fileMD5, but no stamped spec -> modMatchesInstallSpec rejects it, so it
    // reads as not-installed and would be re-pulled. The driver's unconditional spec stamping is
    // exactly what prevents this for real installs.
    const installed = makeMod({
      id: "m-nospec",
      attributes: { referenceTag: tag, fileMD5: "file-abc" },
    });
    const h = makeDriver({
      mods: {
        [GAME_ID]: { [fixture.collection.id]: fixture.collection, [installed.id]: installed },
      },
      downloads: { [fixture.download.id]: fixture.download },
      profiles: { [profile.id]: profile },
    });

    await h.driver.start(profile, fixture.collection);

    expect(h.driver.isInstallComplete(false)).toBe(false);
  });
});
