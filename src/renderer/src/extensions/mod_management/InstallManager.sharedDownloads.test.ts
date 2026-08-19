/**
 * Collection members whose archive is already on disk from a DIFFERENT collection: the download
 * carries that collection's referenceTag, so the member is identified by file hash / repo rather
 * than by tag, and the install engine retags the dependency to match the download.
 *
 * The install session is keyed by each member's rule identity, so these tests pin that a member
 * still settles - without a terminal status the completion poll requeues it every tick and the
 * install never finishes.
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

// the reference the engine hands the installer once it has adopted the download's tag
const adoptedReference = { ...memberRule.reference, tag: FOREIGN_TAG };

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
  // The installer receives the dependency after its reference was retagged to match the download,
  // so the "installed" write no longer carries the identity the session was keyed with.
  imTest("settles as installed when its mod is reused", async ({ makeInstallManager }) => {
    const { h } = makeSharedArchiveInstall(makeInstallManager);

    internals(h.manager).startQueuedInstallation(
      h.api,
      // as gathered: the member's session key alongside the reference the engine retagged
      {
        reference: adoptedReference,
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

describe("a resumed dependency install", () => {
  // Phase state is rebuilt per round, so the round has to read how far the collection already got
  // from the active session; starting at the lowest gathered phase would redo settled phases.
  imTest(
    "starts at the first incomplete phase of the active session",
    async ({ makeInstallManager }) => {
      const laterRule = makeRule({
        type: "requires",
        phase: 1,
        reference: makeExactRef({ tag: "member-later", gameId: GAME, fileMD5: "def456" }),
      });
      const { h, phaseState } = makeSharedArchiveInstall(makeInstallManager, {
        rules: [memberRule, laterRule],
      });
      // phase 0 settled terminally (failed counts as terminal), phase 1 still outstanding
      h.setState((draft) => {
        const mods = draft.session.collections.activeSession!.mods;
        mods[modRuleId(memberRule)].status = "failed";
        mods[modRuleId(laterRule)] = makeModInstallInfo({
          rule: laterRule,
          type: "requires",
          status: "pending",
          phase: 1,
        });
      });
      phaseState.allowedPhase = undefined;

      const installing = internals(h.manager).doInstallDependencies(
        h.api,
        GAME,
        COLLECTION,
        [
          { reference: memberRule.reference, phase: 0, lookupResults: [], extra: {} },
          { reference: laterRule.reference, phase: 1, lookupResults: [], extra: {} },
        ],
        false,
        true,
      );

      try {
        expect(h.phaseTracker.get(COLLECTION)?.allowedPhase).toBe(1);
      } finally {
        internals(h.manager).mDependencyInstalls[COLLECTION]?.();
        delete internals(h.manager).mDependencyInstalls[COLLECTION];
        await installing.catch(() => undefined);
      }
    },
  );
});
