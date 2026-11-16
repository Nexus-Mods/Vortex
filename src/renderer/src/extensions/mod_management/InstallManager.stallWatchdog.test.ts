/**
 * The collection stall watchdog. When a collection makes no progress for five minutes, it fails
 * the collection's member installs (bar any that only just started), then gives up on the
 * collection five minutes later.
 *
 * It used to fail every install older than one minute, including installs waiting on an open
 * FOMOD dialog and the collection archive's own install, and then requeued the failed member while
 * its first install was still running. These suites pin the narrower behaviour. LAZ-1647.
 */
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import {
  makeDownload,
  makeInstallState,
  makeMod,
  makeModInstallInfo,
  makeProfile,
  makeReference,
  makeRule,
  makeSession,
  managerInternals as internals,
} from "../../test-utils/builders";
import type { IDriverHarnessState, IInstallManagerHarness } from "../../test-utils/harnessTypes";
import { test as imTest } from "../../test-utils/installManagerTest";
import { generateCollectionSessionId, modRuleId } from "../../util/collectionInstallSession";
import { MOD_TYPE } from "../collections/constants";
import type { IActiveInstallation } from "./InstallManager";
import { InstallationTimeoutError } from "./util/exceptions";
import { type InstallEvent, InstallListeners } from "./util/installListeners";
import { DIALOG_WAIT_LIMIT_MS } from "./util/stallWatchdog";

vi.mock("../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});
// the poll resolves the staging folder every tick, which reads the app's user-data path
vi.mock("../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

const GAME = "skyrimse";
const PROFILE = "prof-1";
const COLLECTION = "col-1";
const MEMBER_DOWNLOAD = "dl-member";
const MINUTE = 60 * 1000;

const memberRule = makeRule({
  type: "requires",
  reference: makeReference({ tag: "member-a", gameId: GAME }),
});

const memberKey = `${COLLECTION}:${MEMBER_DOWNLOAD}`;
// the collection archive's own install runs outside the collection, so it has no source id
const collectionArchiveKey = "undefined:dl-collection";

/** A collection whose only member is mid-install, so the terminal count can't move. */
function makeInstallingCollection(
  makeInstallManager: (overrides?: Partial<IDriverHarnessState>) => IInstallManagerHarness,
) {
  const h = makeInstallManager({
    profiles: { [PROFILE]: makeProfile({ id: PROFILE, gameId: GAME }) },
    mods: {
      [GAME]: {
        [COLLECTION]: makeMod({
          id: COLLECTION,
          type: MOD_TYPE,
          rules: [memberRule],
          attributes: { collectionId: 1 },
        }),
      },
    },
    downloads: {
      [MEMBER_DOWNLOAD]: makeDownload({
        id: MEMBER_DOWNLOAD,
        state: "finished",
        game: [GAME],
        size: 1024,
        localPath: "member-a.7z",
        modInfo: { referenceTag: "member-a" },
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
            status: "installing",
            phase: 0,
          }),
        },
        totalRequired: 1,
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

  const mgr = internals(h.manager);
  // the poll bails out unless a dependency install is registered for the collection
  mgr.mDependencyInstalls[COLLECTION] = () => undefined;

  return { h, mgr };
}

/** Tracks a running install and records every event its listeners are told. */
function trackInstall(
  installs: Map<string, IActiveInstallation>,
  installId: string,
): IActiveInstallation & { events: InstallEvent[] } {
  const events: InstallEvent[] = [];
  const listeners = new InstallListeners();
  listeners.add((event) => events.push(event));
  const entry = {
    installId,
    archiveId: installId.split(":")[1],
    archivePath: "",
    modId: installId,
    gameId: GAME,
    listeners,
    events,
    startTime: Date.now(),
    baseName: installId,
  };
  installs.set(installId, entry);
  return entry;
}

describe("the collection stall watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  imTest(
    "fails only the stalled collection's members, with the real wait in the message",
    async ({ makeInstallManager }) => {
      const { h, mgr } = makeInstallingCollection(makeInstallManager);
      const member = trackInstall(mgr.mActiveInstalls, memberKey);
      const collectionArchive = trackInstall(mgr.mActiveInstalls, collectionArchiveKey);

      const polling = mgr.pollAllPhasesComplete(h.api, COLLECTION);
      await vi.advanceTimersByTimeAsync(5 * MINUTE + 1000);

      // one event tells every listener: the caller fails, and the hung install gives its slot
      // back, or installs queued behind it would never start
      expect(member.events).toEqual([
        { type: "abandoned", error: expect.any(InstallationTimeoutError), modId: memberKey },
      ]);
      expect(member.events[0]).toHaveProperty(
        "error.message",
        "Installation timed out after 5 minutes",
      );
      expect(member.abandoned).toBe(true);
      expect(mgr.mActiveInstalls.has(memberKey)).toBe(false);

      // the collection archive's install isn't part of this collection's stall
      expect(collectionArchive.events).toEqual([]);
      expect(mgr.mActiveInstalls.get(collectionArchiveKey)).toBe(collectionArchive);

      delete mgr.mDependencyInstalls[COLLECTION];
      await vi.advanceTimersByTimeAsync(1000);
      await polling;
    },
  );

  imTest(
    "fails a member that started after the collection last made progress",
    async ({ makeInstallManager }) => {
      const { h, mgr } = makeInstallingCollection(makeInstallManager);
      const polling = mgr.pollAllPhasesComplete(h.api, COLLECTION);

      // e.g. the next phase's installs, started once the previous phase had settled
      await vi.advanceTimersByTimeAsync(2 * MINUTE);
      const member = trackInstall(mgr.mActiveInstalls, memberKey);
      await vi.advanceTimersByTimeAsync(3 * MINUTE + 1000);

      expect(member.events).toEqual([
        expect.objectContaining({ type: "abandoned", error: expect.any(InstallationTimeoutError) }),
      ]);

      delete mgr.mDependencyInstalls[COLLECTION];
      await vi.advanceTimersByTimeAsync(1000);
      await polling;
    },
  );

  imTest(
    "spares a member that only just started, until it gives up on the collection",
    async ({ makeInstallManager }) => {
      const { h, mgr } = makeInstallingCollection(makeInstallManager);
      const polling = mgr.pollAllPhasesComplete(h.api, COLLECTION);

      await vi.advanceTimersByTimeAsync(5 * MINUTE - 10 * 1000);
      const member = trackInstall(mgr.mActiveInstalls, memberKey);
      await vi.advanceTimersByTimeAsync(11 * 1000);
      expect(member.events).toEqual([]);

      // giving up settles every outstanding member as failed, so the install is abandoned too:
      // finishing later must not report a second outcome
      await vi.advanceTimersByTimeAsync(5 * MINUTE + 1000);
      await polling;
      expect(member.events.map((event) => event.type)).toEqual(["abandoned"]);
      expect(member.abandoned).toBe(true);
      expect(mgr.mActiveInstalls.has(memberKey)).toBe(false);
    },
  );

  imTest(
    "doesn't count time while a FOMOD dialog waits on the user",
    async ({ makeInstallManager }) => {
      const { h, mgr } = makeInstallingCollection(makeInstallManager);
      const member = trackInstall(mgr.mActiveInstalls, memberKey);
      h.setFomodDialog("fomod-1");

      const polling = mgr.pollAllPhasesComplete(h.api, COLLECTION);
      // well past both the rescue and the give-up timeouts
      await vi.advanceTimersByTimeAsync(15 * MINUTE);
      expect(member.events).toEqual([]);
      expect(mgr.mActiveInstalls.get(memberKey)).toBe(member);

      // the stall clock starts once the user has answered
      h.setFomodDialog(null);
      await vi.advanceTimersByTimeAsync(4 * MINUTE);
      expect(member.events).toEqual([]);
      await vi.advanceTimersByTimeAsync(1 * MINUTE + 1000);
      expect(member.events.map((event) => event.type)).toEqual(["abandoned"]);

      delete mgr.mDependencyInstalls[COLLECTION];
      await vi.advanceTimersByTimeAsync(1000);
      await polling;
    },
  );

  imTest(
    "doesn't count time while a prompt dialog waits on the user",
    async ({ makeInstallManager }) => {
      const { h, mgr } = makeInstallingCollection(makeInstallManager);
      const member = trackInstall(mgr.mActiveInstalls, memberKey);
      h.openModalDialog();

      const polling = mgr.pollAllPhasesComplete(h.api, COLLECTION);
      await vi.advanceTimersByTimeAsync(15 * MINUTE);

      expect(member.events).toEqual([]);

      // the dialog may have nothing to do with the install, so it only holds the clock for so long
      await vi.advanceTimersByTimeAsync(DIALOG_WAIT_LIMIT_MS - 15 * MINUTE + 5 * MINUTE + 1000);
      expect(member.events.map((event) => event.type)).toEqual(["abandoned"]);

      delete mgr.mDependencyInstalls[COLLECTION];
      await vi.advanceTimersByTimeAsync(1000);
      await polling;
    },
  );
});

describe("a member the stall watchdog gave up on", () => {
  // the watchdog doesn't cancel the install, so a retry would run a second install of the same
  // archive alongside the first
  imTest("is settled as failed rather than requeued", async ({ makeInstallManager }) => {
    const { h, mgr } = makeInstallingCollection(makeInstallManager);
    vi.spyOn(mgr, "installModAsync").mockRejectedValue(new InstallationTimeoutError(5 * MINUTE));

    mgr.startQueuedInstallation(
      h.api,
      {
        reference: memberRule.reference,
        sessionRuleId: modRuleId(memberRule),
        phase: 0,
        extra: {},
      },
      MEMBER_DOWNLOAD,
      GAME,
      COLLECTION,
      false,
      0,
    );

    await vi.waitFor(() => {
      expect(
        h.getState().session.collections.activeSession?.mods[modRuleId(memberRule)]?.status,
      ).toBe("failed");
    });
    expect(mgr.mPendingInstalls.has(memberKey)).toBe(false);
  });

  const startMember = (h: IInstallManagerHarness, mgr: ReturnType<typeof internals>) =>
    mgr.startQueuedInstallation(
      h.api,
      {
        reference: memberRule.reference,
        sessionRuleId: modRuleId(memberRule),
        phase: 0,
        extra: {},
      },
      MEMBER_DOWNLOAD,
      GAME,
      COLLECTION,
      false,
      0,
    );
  const memberStatus = (h: IInstallManagerHarness) =>
    h.getState().session.collections.activeSession?.mods[modRuleId(memberRule)]?.status;

  imTest("is failed even when its install hasn't started yet", async ({ makeInstallManager }) => {
    const { h, mgr } = makeInstallingCollection(makeInstallManager);
    // stuck before the install registers, e.g. statting the archive on an unresponsive drive
    vi.spyOn(mgr, "installModAsync").mockReturnValue(new Promise<string>(() => undefined));
    startMember(h, mgr);
    await vi.waitFor(() => expect(mgr.installModAsync).toHaveBeenCalled());

    expect(h.manager.forceCleanupStuckInstalls(h.api, COLLECTION, 0)).toBe(1);

    await vi.waitFor(() => expect(memberStatus(h)).toBe("failed"));
    expect(mgr.mActiveInstalls.has(memberKey)).toBe(false);
  });

  imTest(
    "is settled as installed if its install succeeds after all",
    async ({ makeInstallManager }) => {
      const { h, mgr } = makeInstallingCollection(makeInstallManager);
      h.setState((draft) => {
        draft.persistent.mods[GAME]["member-a"] = makeMod({ id: "member-a" });
      });
      let finishInstall: (modId: string) => void;
      vi.spyOn(mgr, "installModAsync").mockReturnValue(
        new Promise<string>((resolve) => {
          finishInstall = resolve;
        }),
      );
      startMember(h, mgr);
      await vi.waitFor(() => expect(mgr.installModAsync).toHaveBeenCalled());
      h.manager.forceCleanupStuckInstalls(h.api, COLLECTION, 0);
      await vi.waitFor(() => expect(memberStatus(h)).toBe("failed"));

      // a large archive that was slow rather than hung
      finishInstall("member-a");

      await vi.waitFor(() => expect(memberStatus(h)).toBe("installed"));
      // and gets what any installed member gets: enabled in the collection's profile
      expect(h.dispatched).toContainEqual(
        expect.objectContaining({
          type: "SET_MOD_ENABLED",
          payload: { profileId: PROFILE, modId: "member-a", enable: true },
        }),
      );
    },
  );
});
