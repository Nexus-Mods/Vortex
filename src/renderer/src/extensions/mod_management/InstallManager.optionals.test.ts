/**
 * Optional-member install routing, driven through the REAL InstallManager via the makeInstallManager
 * harness (fake api + real event wiring, builder-seeded state) rather than hand-built mocks. Focus:
 * a selected optional's finished download queues its install at OPTIONAL_PHASE (rulePhase for a
 * recommends rule) through the real handleDownloadFinished -> queueInstallation, not at phase 0 -
 * the heart of the "optionals as a trailing phase" model.
 */
import { describe, expect, vi } from "vitest";

import {
  makeDownload,
  makeMod,
  makeModInstallInfo,
  makeReference,
  makeRule,
  makeSession,
} from "../../test-utils/builders";
import { test as imTest } from "../../test-utils/installManagerTest";
import { generateCollectionSessionId, modRuleId } from "../../util/collectionInstallSession";
import { MOD_TYPE } from "../collections/constants";
import type { IProfile } from "../profile_management/types/IProfile";
import { OPTIONAL_PHASE } from "./util/rulePhase";

vi.mock("../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});

const GAME = "skyrimse";
const PROFILE = "prof-1";
const COLLECTION = "col-1";

describe("InstallManager optional install routing", () => {
  imTest(
    "queues a finished optional download at OPTIONAL_PHASE, deferred behind a pending required",
    async ({ makeInstallManager }) => {
      const requiredRule = makeRule({
        type: "requires",
        reference: makeReference({ tag: "req-a" }),
      });
      const optionalRule = makeRule({
        type: "recommends",
        reference: makeReference({ tag: "opt-a" }),
      });
      const sessionId = generateCollectionSessionId(COLLECTION, PROFILE);

      const h = makeInstallManager({
        profiles: {
          [PROFILE]: { id: PROFILE, gameId: GAME, modState: {}, name: "t" } as unknown as IProfile,
        },
        mods: {
          [GAME]: {
            [COLLECTION]: makeMod({
              id: COLLECTION,
              type: MOD_TYPE,
              rules: [requiredRule, optionalRule],
              attributes: { collectionId: 1 },
            }),
          },
        },
        downloads: {
          "dl-opt": makeDownload({
            id: "dl-opt",
            state: "finished",
            localPath: "opt-a.7z",
            modInfo: { referenceTag: "opt-a" },
          }),
        },
        session: {
          activeSession: makeSession({
            sessionId,
            collectionId: COLLECTION,
            profileId: PROFILE,
            gameId: GAME,
            mods: {
              [modRuleId(requiredRule)]: makeModInstallInfo({
                rule: requiredRule,
                type: "requires",
                status: "pending",
              }),
              [modRuleId(optionalRule)]: makeModInstallInfo({
                rule: optionalRule,
                type: "recommends",
                status: "downloading",
              }),
            },
            totalRequired: 1,
            totalOptional: 1,
          }),
          lastActiveSessionId: undefined,
          sessionHistory: {},
        },
      });

      // active profile so activeProfile()/findCollectionByDownload resolve the game + session
      h.setState((draft) => {
        draft.settings.profiles.activeProfileId = PROFILE;
      });

      // phase state must exist for handleDownloadFinished to queue; the required member stays
      // pending so canStartInstallationTasks defers the optional install to pendingByPhase instead
      // of extracting an archive on disk
      h.phaseTracker.ensure(COLLECTION);

      // a finished collection download fires did-finish-download -> handleDownloadFinished
      h.emit("did-finish-download", "dl-opt", "finished");

      const phaseState = h.phaseTracker.get(COLLECTION);
      // routed to the trailing optional phase, not phase 0
      expect(phaseState.pendingByPhase.get(OPTIONAL_PHASE)?.length).toBe(1);
      expect(phaseState.pendingByPhase.get(0)).toBeUndefined();
      // the same path records the member as downloaded on the session
      expect(
        h.getState().session.collections.activeSession?.mods[modRuleId(optionalRule)]?.status,
      ).toBe("downloaded");
    },
  );
});
