import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";

import {
  VortexModId,
  VortexModStagingFolder,
  VortexProfileId,
  VortexStagingFolder,
} from "@vortex/shared";
import { describe, expect, it, vi } from "vitest";

import {
  makeFileChange,
  makeMod,
  makeProfile,
  setCollectionSession,
} from "../../../test-utils/builders";
import { test as deploymentTest } from "../../../test-utils/deploymentTest";
import {
  confirmExternalChangesDialogs,
  EXTERNAL_CHANGES_BINDINGS,
  test,
} from "../../../test-utils/externalChangesTest";
import { MERGED_PATH } from "../modMerging";
import { changeToEntry, dealWithExternalChanges } from "./externalChanges";

vi.mock("../../../logging", () => {
  const log = vi.fn();
  return { default: log, log };
});

const MOD_A = VortexModId("mod-a");
const MOD_A_FOLDER = VortexModStagingFolder("mod-a-folder");
const REMOVED_FOLDER = VortexModStagingFolder("removed-folder");
const MODS_WITH_A = { [MOD_A]: makeMod({ id: MOD_A, installationPath: MOD_A_FOLDER }) };

describe("changeToEntry", () => {
  const existing = new Set([MOD_A_FOLDER]);

  it("preselects restoring a deployed file that was deleted on disk", () => {
    const change = makeFileChange({ changeType: "deleted", source: MOD_A_FOLDER });

    expect(changeToEntry("", change, existing).action).toBe("restore");
  });

  it("preselects keeping the deployed file when its mod's staging folder still exists", () => {
    const change = makeFileChange({ changeType: "srcdeleted", source: MOD_A_FOLDER });

    expect(changeToEntry("", change, existing).action).toBe("import");
  });

  it("preselects removing the deployed file when its mod's staging folder is gone", () => {
    const change = makeFileChange({ changeType: "srcdeleted", source: REMOVED_FOLDER });

    expect(changeToEntry("", change, existing).action).toBe("drop");
  });
});

describe("dealWithExternalChanges", () => {
  deploymentTest("re-deploys a file deleted from the game folder", async ({ makeDeployment }) => {
    const profile = makeProfile();
    const h = makeDeployment({
      files: { "plugin.esp": "plugin" },
      profiles: { [profile.id]: profile },
      activeProfileId: profile.id,
      extraReducers: EXTERNAL_CHANGES_BINDINGS,
    });
    confirmExternalChangesDialogs(h);
    const manifest = await h.deploy();
    rmSync(h.inGame("plugin.esp"));

    const [resolved] = await dealWithExternalChanges(
      h.api,
      h.method,
      VortexProfileId(profile.id),
      VortexStagingFolder(h.stagingDir),
      { "": h.gameDir },
      { "": manifest },
      new Set(),
    );
    await h.deploy(resolved);

    expect(h.deployedFiles()).toEqual(["plugin.esp"]);
  });

  test("keeps the deployed file of a mod whose staging file was deleted", async ({
    makeExternalChanges,
  }) => {
    const h = await makeExternalChanges([
      makeFileChange({ changeType: "srcdeleted", source: MOD_A_FOLDER, filePath: "plugin.esp" }),
    ]);
    await h.stageFile(MOD_A_FOLDER, "other.esp");
    await h.deployFile("plugin.esp");

    await h.dealWithExternalChanges(new Set());

    expect(h.dialogs).toHaveLength(1);
    expect(existsSync(path.join(h.stagingPath, MOD_A_FOLDER, "plugin.esp"))).toBe(true);
  });

  test("removes the deployed file of a mod whose staging folder is gone", async ({
    makeExternalChanges,
  }) => {
    const h = await makeExternalChanges([
      makeFileChange({ changeType: "srcdeleted", source: REMOVED_FOLDER, filePath: "plugin.esp" }),
    ]);
    await h.deployFile("plugin.esp");

    await h.dealWithExternalChanges(new Set());

    expect(h.dialogs).toHaveLength(1);
    expect(existsSync(path.join(h.gameDir, "plugin.esp"))).toBe(false);
  });

  test("reports a mod's changed content by game and mod id", async ({ makeExternalChanges }) => {
    const h = await makeExternalChanges(
      [makeFileChange({ changeType: "srcdeleted", source: MOD_A_FOLDER })],
      MODS_WITH_A,
    );
    await h.stageFile(MOD_A_FOLDER, "other.esp");
    const changed: Array<[string, string]> = [];
    h.api.events.on("mod-content-changed", (gameId: string, modId: string) => {
      changed.push([gameId, modId]);
    });

    await h.dealWithExternalChanges(new Set());

    expect(changed).toEqual([[h.gameId, MOD_A]]);
  });

  test("checks the file overrides of files deleted from staging by game and mod id", async ({
    makeExternalChanges,
  }) => {
    const h = await makeExternalChanges(
      [makeFileChange({ changeType: "srcdeleted", source: MOD_A_FOLDER, filePath: "plugin.esp" })],
      MODS_WITH_A,
    );
    const checked: Array<[string, Record<VortexModId, string[]>]> = [];
    h.api.events.on(
      "check-file-override-redundancies",
      (gameId: string, deletedFiles: Record<VortexModId, string[]>) => {
        checked.push([gameId, deletedFiles]);
      },
    );

    await h.dealWithExternalChanges(new Set());

    expect(checked).toEqual([[h.gameId, { [MOD_A]: ["plugin.esp"] }]]);
  });

  test("auto-resolves __merged changes regardless of recentChanges", async ({
    makeExternalChanges,
  }) => {
    const h = await makeExternalChanges([
      makeFileChange({ source: `${MERGED_PATH}_skyrim`, filePath: "Data/merged.esp" }),
    ]);

    await h.dealWithExternalChanges(new Set());

    expect(h.dialogs).toHaveLength(0);
  });

  test("auto-resolves every change during a collection install", async ({
    makeExternalChanges,
  }) => {
    const h = await makeExternalChanges([
      makeFileChange({ source: "some-mod-A", filePath: "Data/a.bsa" }),
      makeFileChange({ source: "some-mod-B", filePath: "Data/b.bsa" }),
    ]);
    setCollectionSession(h, true);

    await h.dealWithExternalChanges(new Set());

    expect(h.dialogs).toHaveLength(0);
  });

  test("treats an undefined recentChanges as 'nothing recently touched'", async ({
    makeExternalChanges,
  }) => {
    const h = await makeExternalChanges([
      makeFileChange({ source: "any-mod", filePath: "Data/file.esp" }),
    ]);

    await h.dealWithExternalChanges(undefined);

    expect(h.dialogs).toHaveLength(1);
    expect(h.dialogs[0][0].source).toBe("any-mod");
  });

  // A deployment cycle consumes the recentChanges snapshot ONCE at the start,
  // then runs dealWithExternalChanges against that snapshot. If a second
  // install completes after the snapshot is taken (e.g. parallel installers,
  // or an install that finished while the first deployment was still in
  // flight), its installation path is not in the local recentChanges seen
  // by the current dealWithExternalChanges call. A refchange attributed to
  // that just-installed mod therefore surfaces to the user, even though
  // Vortex did install it. This is correct behavior given the input; the
  // upstream concern is whether two install/deploy flows should overlap at
  // all. Locks in the snapshot-at-consume-time contract between
  // InstallManager and dealWithExternalChanges.
  test("only auto-resolves against the recentChanges snapshot taken at consume time", async ({
    makeInstallManager,
    makeExternalChanges,
  }) => {
    const gameId = "skyrimse";
    const modA = "mod-A-installed-before-consume";
    const modB = "mod-B-installed-after-consume";
    const { manager } = makeInstallManager({
      mods: {
        [gameId]: {
          [modA]: makeMod({ id: modA, installationPath: modA }),
          [modB]: makeMod({ id: modB, installationPath: modB }),
        },
      },
    });

    // Install A completes BEFORE the deployment cycle starts.
    manager.markRecentInstall(modA, gameId);

    // Deployment cycle begins: snapshot recentChanges.
    const snapshot = manager.consumeRecentChanges();
    expect(snapshot).toEqual(new Set([modA]));

    // Install B completes WHILE the deployment cycle is in flight, after
    // the snapshot has been taken. Its path goes into the next batch.
    manager.markRecentInstall(modB, gameId);

    // The current deployment cycle calls dealWithExternalChanges with the
    // snapshot. The activator reports a refchange attributed to mod B
    // (a stale manifest entry, an in-flight unlink/relink, etc.).
    const h = await makeExternalChanges([
      makeFileChange({ source: modA, filePath: "Data/a.esp" }),
      makeFileChange({ source: modB, filePath: "Data/b.esp" }),
    ]);

    await h.dealWithExternalChanges(snapshot);

    // A is auto-resolved (in snapshot), B surfaces (not in snapshot).
    expect(h.dialogs).toHaveLength(1);
    expect(h.dialogs[0].map((entry) => entry.source)).toEqual([modB]);

    // The next deployment cycle would pick up B.
    expect(manager.consumeRecentChanges()).toEqual(new Set([modB]));
  });
});
