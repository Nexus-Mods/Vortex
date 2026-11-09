/**
 * Collection members whose archive is already on disk from a DIFFERENT collection: the download
 * carries that collection's referenceTag, so the member is identified by file hash / repo rather
 * than by tag.
 *
 * The session is keyed by each member's rule identity. Without a terminal status the completion
 * poll requeues the member every tick and the install never finishes.
 */
import { describe, expect, vi } from "vitest";

import {
  makeDownload,
  makeExactRef,
  makeInstallState,
  makeMod,
  makeModInstallInfo,
  makeProfile,
  makeRule,
  makeSession,
  managerInternals as internals,
} from "../../test-utils/builders";
import type { IDriverHarnessState, IInstallManagerHarness } from "../../test-utils/harnessTypes";
import { test as imTest } from "../../test-utils/installManagerTest";
import { generateCollectionSessionId, modRuleId } from "../../util/collectionInstallSession";
import { MOD_TYPE } from "../collections/constants";
import { OPTIONAL_PHASE } from "./util/rulePhase";

vi.mock("../../logging", () => ({ log: vi.fn() }));

const GAME = "skyrimse";
const PROFILE = "prof-1";
const COLLECTION = "col-1";
const SHARED_DOWNLOAD = "dl-shared";
const SHARED_MOD = "m-shared";
// the tag the collection that downloaded the archive first stamped on it
const FOREIGN_TAG = "foreign-tag";

// this collection's member: repo-pinned and hash-pinned, so it resolves the shared archive and the
// installed mod by identity even though neither carries its tag
const memberRule = makeRule({
  type: "requires",
  reference: makeExactRef({ tag: "member-orig", gameId: GAME, md5Hint: "abc123" }),
});

// a member reference whose tag drifted away from the rule the session is keyed with
const driftedReference = { ...memberRule.reference, tag: FOREIGN_TAG };

// a second required member, one phase later than memberRule
const laterRule = makeRule({
  type: "requires",
  phase: 1,
  reference: makeExactRef({ tag: "member-later", gameId: GAME, fileMD5: "def456" }),
});

// the dependency list a resumed round gathers for both required members
const bothPhaseDeps = [
  { reference: memberRule.reference, phase: 0, lookupResults: [], extra: {} },
  { reference: laterRule.reference, phase: 1, lookupResults: [], extra: {} },
];

/**
 * Run one dependency round far enough to read the phase frontier it set, then unwind it - the
 * round never settles on its own here, since nothing drives the gathered members. Clearing
 * allowedPhase makes it a re-entry.
 */
async function frontierAfterRound(
  h: IInstallManagerHarness,
  dependencies: unknown[],
  recommendations = false,
): Promise<number | undefined> {
  const phaseState = h.phaseTracker.get(COLLECTION);
  if (phaseState !== undefined) {
    phaseState.allowedPhase = undefined;
  }
  const installing = internals(h.manager).doInstallDependencies(
    h.api,
    GAME,
    COLLECTION,
    dependencies,
    recommendations,
    true,
  );
  try {
    return h.phaseTracker.get(COLLECTION)?.allowedPhase;
  } finally {
    internals(h.manager).mDependencyInstalls[COLLECTION]?.();
    delete internals(h.manager).mDependencyInstalls[COLLECTION];
    await installing.catch(() => undefined);
  }
}

/**
 * A collection install where the member's archive is already downloaded under another collection's
 * tag, and that collection's copy of the mod is still installed. The session tracks the member as
 * "downloaded", which is what the archive being present reconstructs to.
 */
function makeSharedArchiveInstall(
  makeInstallManager: (overrides?: Partial<IDriverHarnessState>) => IInstallManagerHarness,
  opts: { rules?: (typeof memberRule)[]; mods?: Record<string, ReturnType<typeof makeMod>> } = {},
) {
  const rules = opts.rules ?? [memberRule];
  const h = makeInstallManager({
    profiles: { [PROFILE]: makeProfile({ id: PROFILE, gameId: GAME }) },
    mods: {
      [GAME]: {
        [COLLECTION]: makeMod({
          id: COLLECTION,
          type: MOD_TYPE,
          rules,
          attributes: { collectionId: 1 },
        }),
        [SHARED_MOD]: makeMod({
          id: SHARED_MOD,
          state: "installed",
          attributes: {
            referenceTag: FOREIGN_TAG,
            fileMD5: "abc123",
            source: "nexus",
            modId: 100,
            fileId: 5,
            installedAsDependency: true,
          },
        }),
        ...opts.mods,
      },
    },
    downloads: {
      [SHARED_DOWNLOAD]: makeDownload({
        id: SHARED_DOWNLOAD,
        state: "finished",
        game: [GAME],
        size: 1024,
        localPath: "shared.7z",
        fileMD5: "abc123",
        modInfo: { referenceTag: FOREIGN_TAG, nexus: { ids: { modId: 100, fileId: 5 } } },
      }),
    },
    session: makeInstallState({
      activeSession: makeSession({
        sessionId: generateCollectionSessionId(COLLECTION, PROFILE),
        collectionId: COLLECTION,
        profileId: PROFILE,
        gameId: GAME,
        mods: {
          [modRuleId(memberRule)]: makeModInstallInfo({
            rule: memberRule,
            type: "requires",
            status: "downloaded",
            phase: 0,
          }),
        },
        totalRequired: 1,
        downloadedCount: 1,
      }),
    }),
  });

  h.setState((draft) => {
    draft.settings.profiles.activeProfileId = PROFILE;
  });

  const phaseState = h.phaseTracker.ensure(COLLECTION);
  phaseState.allowedPhase = 0;
  phaseState.downloadsFinished.add(0);
  phaseState.deployedPhases.add(0);

  return { h, phaseState };
}

const memberStatus = (h: IInstallManagerHarness) =>
  h.getState().session.collections.activeSession?.mods[modRuleId(memberRule)];

describe("a collection member satisfied by another collection's download", () => {
  // A member whose reference identity drifted from its rule cannot be matched back to the session
  // by identity, so the "installed" write has to be addressed by the member's own key.
  imTest("settles as installed when its mod is reused", async ({ makeInstallManager }) => {
    const { h } = makeSharedArchiveInstall(makeInstallManager);

    internals(h.manager).startQueuedInstallation(
      h.api,
      // as gathered: the member's session key alongside a drifted reference
      {
        reference: driftedReference,
        sessionRuleId: modRuleId(memberRule),
        phase: 0,
        extra: {},
      },
      SHARED_DOWNLOAD,
      GAME,
      COLLECTION,
      false,
      0,
    );

    await vi.waitFor(() => {
      expect(memberStatus(h)?.status).toBe("installed");
    });
    expect(memberStatus(h)?.modId).toBe(SHARED_MOD);
  });

  // The requeue pass is the poll's backstop: it runs every tick for as long as the member is
  // non-terminal, so it is the last chance to settle a member whose install already happened.
  imTest("settles as installed in a single requeue pass", async ({ makeInstallManager }) => {
    const { h } = makeSharedArchiveInstall(makeInstallManager);
    const installEvents: string[] = [];
    h.api.events.on("did-install-mod", (_gameId: string, _archiveId: string, modId: string) =>
      installEvents.push(modId),
    );

    const mgr = internals(h.manager);
    const status = mgr.checkCollectionPhaseStatus(h.api, COLLECTION, 0);
    mgr.reQueueDownloadedMods(h.api, COLLECTION, status.allMods, 0);

    expect(memberStatus(h)?.status).toBe("installed");
    expect(memberStatus(h)?.modId).toBe(SHARED_MOD);
    expect(installEvents.length).toBeLessThanOrEqual(1);
  });
});

describe("a required and an optional member backed by the same file", () => {
  // same reference identity, so the two session entries differ only in their rule id; the settle
  // write must land on the entry being requeued, not on whichever entry matches the reference first
  const optionalRule = makeRule({
    type: "recommends",
    reference: memberRule.reference,
    ignored: false,
  });

  imTest("settles the requeued optional on its own session entry", ({ makeInstallManager }) => {
    const { h } = makeSharedArchiveInstall(makeInstallManager, {
      rules: [memberRule, optionalRule],
    });
    h.setState((draft) => {
      const mods = draft.session.collections.activeSession.mods;
      // the required member already settled on the shared mod
      mods[modRuleId(memberRule)].status = "installed";
      mods[modRuleId(memberRule)].modId = SHARED_MOD;
      mods[modRuleId(optionalRule)] = makeModInstallInfo({
        rule: optionalRule,
        type: "recommends",
        status: "downloaded",
        phase: OPTIONAL_PHASE,
      });
    });

    const mgr = internals(h.manager);
    const status = mgr.checkCollectionPhaseStatus(h.api, COLLECTION, OPTIONAL_PHASE);
    mgr.reQueueDownloadedMods(h.api, COLLECTION, status.allMods, OPTIONAL_PHASE);

    const optional = h.getState().session.collections.activeSession?.mods[modRuleId(optionalRule)];
    expect(optional?.status).toBe("installed");
    expect(optional?.modId).toBe(SHARED_MOD);
  });
});

describe("resolving a member's already-present download", () => {
  // The archive satisfies this collection's rule too, so it records this rule's tag alongside the
  // one it already carries. The rule itself is left alone: the session is keyed from it.
  imTest("records this collection's tag on the download", async ({ makeInstallManager }) => {
    const { h } = makeSharedArchiveInstall(makeInstallManager);

    const installing = internals(h.manager).doInstallDependencies(
      h.api,
      GAME,
      COLLECTION,
      [
        {
          reference: memberRule.reference,
          sessionRuleId: modRuleId(memberRule),
          download: SHARED_DOWNLOAD,
          phase: 0,
          lookupResults: [],
          extra: {},
        },
      ],
      false,
      true,
    );

    try {
      await vi.waitFor(() => {
        const tags =
          h.getState().persistent.downloads.files[SHARED_DOWNLOAD].modInfo?.referenceTags;
        expect(tags).toContain(memberRule.reference.tag);
      });
      // the first collection's tag is kept, so its rules still resolve this archive
      const modInfo = h.getState().persistent.downloads.files[SHARED_DOWNLOAD].modInfo;
      expect(modInfo?.referenceTags).toContain(FOREIGN_TAG);
      expect(modInfo?.referenceTag).toBe(FOREIGN_TAG);
      // the collection's own rules are untouched
      const ruleActions = h.dispatched.filter(
        (action) => action.type.includes("MOD_RULE") || action.type.includes("ModRule"),
      );
      expect(ruleActions).toEqual([]);
      expect(h.getState().persistent.mods[GAME][COLLECTION].rules?.[0]?.reference.tag).toBe(
        memberRule.reference.tag,
      );
    } finally {
      internals(h.manager).mDependencyInstalls[COLLECTION]?.();
      delete internals(h.manager).mDependencyInstalls[COLLECTION];
      await installing.catch(() => undefined);
    }
  });
});

describe("a resumed dependency install", () => {
  // Phase state is rebuilt per round, so the round has to read how far the collection already got
  // from the active session; starting at the lowest gathered phase would redo settled phases.
  imTest("re-enters at the failed required member's phase", async ({ makeInstallManager }) => {
    const { h } = makeSharedArchiveInstall(makeInstallManager, {
      rules: [memberRule, laterRule],
    });
    // phase 0 has a FAILED required member, which the round re-gathers for retry - so the
    // frontier must start AT phase 0, not past it; phase 1 stays gated until the retry settles
    h.setState((draft) => {
      const mods = draft.session.collections.activeSession.mods;
      mods[modRuleId(memberRule)].status = "failed";
      mods[modRuleId(laterRule)] = makeModInstallInfo({
        rule: laterRule,
        type: "requires",
        status: "pending",
        phase: 1,
      });
    });

    expect(await frontierAfterRound(h, bothPhaseDeps)).toBe(0);
  });

  // The gather re-lists a member whose reference drifted from the mod that satisfies it, so a
  // settled phase can arrive with its member still in the dependency list. The frontier reads the
  // session, not the list, and starts past the phase rather than redoing it.
  imTest("starts past a genuinely complete prefix", async ({ makeInstallManager }) => {
    const { h } = makeSharedArchiveInstall(makeInstallManager, {
      rules: [memberRule, laterRule],
    });
    h.setState((draft) => {
      const mods = draft.session.collections.activeSession.mods;
      mods[modRuleId(memberRule)].status = "installed";
      mods[modRuleId(memberRule)].modId = SHARED_MOD;
      mods[modRuleId(laterRule)] = makeModInstallInfo({
        rule: laterRule,
        type: "requires",
        status: "pending",
        phase: 1,
      });
    });

    expect(await frontierAfterRound(h, bothPhaseDeps)).toBe(1);
  });

  // Optionals run in a trailing phase of their own, reached only once every required phase has
  // settled - the round that installs them gathers nothing else.
  imTest(
    "reaches the optional phase when the required prefix is complete",
    async ({ makeInstallManager }) => {
      const optionalRule = makeRule({
        type: "recommends",
        ignored: false,
        reference: makeExactRef({ tag: "member-opt", gameId: GAME, fileMD5: "def456" }),
      });
      const { h } = makeSharedArchiveInstall(makeInstallManager, {
        rules: [memberRule, optionalRule],
      });
      h.setState((draft) => {
        const mods = draft.session.collections.activeSession.mods;
        mods[modRuleId(memberRule)].status = "installed";
        mods[modRuleId(memberRule)].modId = SHARED_MOD;
        mods[modRuleId(optionalRule)] = makeModInstallInfo({
          rule: optionalRule,
          type: "recommends",
          status: "pending",
          phase: OPTIONAL_PHASE,
        });
      });

      const optionalDeps = [
        { reference: optionalRule.reference, phase: OPTIONAL_PHASE, lookupResults: [], extra: {} },
      ];
      expect(await frontierAfterRound(h, optionalDeps, true)).toBe(OPTIONAL_PHASE);
    },
  );

  // Session ids are collectionId_profileId, so an earlier install of the same collection on the
  // same profile sits in history under the id this round computes. Phase completion is only ever
  // read from the active session, so a history hit must not drive the phase frontier.
  imTest(
    "starts at the lowest gathered phase when the only session for the collection is history",
    async ({ makeInstallManager }) => {
      const { h } = makeSharedArchiveInstall(makeInstallManager, {
        rules: [memberRule, laterRule],
      });
      const sessionId = generateCollectionSessionId(COLLECTION, PROFILE);
      h.setState((draft) => {
        draft.session.collections = makeInstallState({
          lastActiveSessionId: sessionId,
          sessionHistory: {
            [sessionId]: makeSession({
              sessionId,
              collectionId: COLLECTION,
              profileId: PROFILE,
              gameId: GAME,
              mods: {
                [modRuleId(memberRule)]: makeModInstallInfo({
                  rule: memberRule,
                  type: "requires",
                  status: "installed",
                  phase: 0,
                }),
                [modRuleId(laterRule)]: makeModInstallInfo({
                  rule: laterRule,
                  type: "requires",
                  status: "installed",
                  phase: 1,
                }),
              },
              totalRequired: 2,
            }),
          },
        });
      });
      expect(await frontierAfterRound(h, bothPhaseDeps)).toBe(0);
    },
  );
});
