import { NexusFileId } from "@nexusmods/mod-pipeline";
import { VortexModTypeId } from "@vortex/shared";
import { describe, expect, test } from "vitest";

import { makeDeployedFile } from "../../../test-utils/builders";
import {
  makeGeneratedFileSource,
  makeLockfile,
  makeNexusFileSource,
} from "../../../test-utils/lockfileBuilders";
import { compareManifestFiles, compareWithDeployment, ReasonCode } from "./shadowComparison";

const NO_MISMATCHES = {
  [ReasonCode.MissingFromLockfile]: 0,
  [ReasonCode.MissingFromDeploy]: 0,
  [ReasonCode.DifferentWinner]: 0,
};

describe("compareWithDeployment", () => {
  test("passes a lockfile that lists what the deployment wrote, whatever the letter case", () => {
    const deployed = [
      makeNexusFileSource({ destinationPath: "/fixture-root/game/data/skyui_se.ESP" }),
    ];

    expect(
      compareWithDeployment(makeLockfile({ files: [makeNexusFileSource()] }), deployed),
    ).toEqual({ verdict: "pass", counts: NO_MISMATCHES });
  });

  test("gives each mismatch one reason code", () => {
    const lockfile = makeLockfile({
      files: [
        makeNexusFileSource({ destinationPath: "/fixture-root/game/Data/Listed.esp" }),
        makeNexusFileSource({ destinationPath: "/fixture-root/game/Data/Shared.esp" }),
      ],
    });
    const deployed = [
      makeNexusFileSource({ destinationPath: "/fixture-root/game/Data/Deployed.esp" }),
      makeNexusFileSource({
        destinationPath: "/fixture-root/game/Data/Shared.esp",
        nexusFileId: NexusFileId("2"),
      }),
    ];

    expect(compareWithDeployment(lockfile, deployed)).toEqual({
      verdict: "fail",
      counts: {
        [ReasonCode.MissingFromLockfile]: 1,
        [ReasonCode.MissingFromDeploy]: 1,
        [ReasonCode.DifferentWinner]: 1,
      },
    });
  });

  test("leaves out the generated files a deployment's manifests do not list", () => {
    const lockfile = makeLockfile({ files: [makeGeneratedFileSource()] });

    expect(compareWithDeployment(lockfile, [])).toEqual({
      verdict: "pass",
      counts: NO_MISMATCHES,
    });
  });
});

describe("compareManifestFiles", () => {
  const DEFAULT_TYPE = VortexModTypeId("");
  const DINPUT_TYPE = VortexModTypeId("dinput");

  test("passes the same entries, whatever their order", () => {
    const plugin = makeDeployedFile({ relPath: "plugin.esp" });
    const texture = makeDeployedFile({ relPath: "sky.dds" });

    expect(
      compareManifestFiles(
        new Map([[DEFAULT_TYPE, [plugin, texture]]]),
        new Map([[DEFAULT_TYPE, [texture, plugin]]]),
      ),
    ).toEqual({ verdict: "pass", counts: NO_MISMATCHES });
  });

  test("passes mods that deploy one path each into its own folder", () => {
    const readmeOfA = makeDeployedFile({ relPath: "readme.txt", source: "mod-a", target: "mod-a" });
    const readmeOfB = makeDeployedFile({ relPath: "readme.txt", source: "mod-b", target: "mod-b" });

    expect(
      compareManifestFiles(
        new Map([[DEFAULT_TYPE, [readmeOfA, readmeOfB]]]),
        new Map([[DEFAULT_TYPE, [readmeOfA, readmeOfB]]]),
      ),
    ).toEqual({ verdict: "pass", counts: NO_MISMATCHES });
  });

  test("counts an entry only one side lists, and one listed under another mod type, as missing", () => {
    const resolved = makeDeployedFile({ relPath: "resolved.esp" });
    const deployed = makeDeployedFile({ relPath: "deployed.esp" });
    const loader = makeDeployedFile({ relPath: "loader.dll" });

    expect(
      compareManifestFiles(
        new Map([
          [DEFAULT_TYPE, [resolved]],
          [DINPUT_TYPE, [loader]],
        ]),
        new Map([[DEFAULT_TYPE, [deployed, loader]]]),
      ),
    ).toEqual({
      verdict: "fail",
      counts: {
        ...NO_MISMATCHES,
        [ReasonCode.MissingFromLockfile]: 2,
        [ReasonCode.MissingFromDeploy]: 2,
      },
    });
  });

  test("counts a path the deployment listed under a second mod type as missing from the lockfile", () => {
    const shared = makeDeployedFile({ relPath: "shared.txt" });
    const sharedInGameRoot = makeDeployedFile({ relPath: "Data/shared.txt", source: "mod-2" });

    expect(
      compareManifestFiles(
        new Map([[DEFAULT_TYPE, [shared]]]),
        new Map([
          [DEFAULT_TYPE, [shared]],
          [DINPUT_TYPE, [sharedInGameRoot]],
        ]),
      ),
    ).toEqual({
      verdict: "fail",
      counts: { ...NO_MISMATCHES, [ReasonCode.MissingFromLockfile]: 1 },
    });
  });

  test("counts an entry saved from another mod as a different winner", () => {
    const contested = makeDeployedFile({ source: "mod-a" });

    expect(
      compareManifestFiles(
        new Map([[DEFAULT_TYPE, [contested]]]),
        new Map([[DEFAULT_TYPE, [{ ...contested, source: "mod-b" }]]]),
      ),
    ).toEqual({
      verdict: "fail",
      counts: { ...NO_MISMATCHES, [ReasonCode.DifferentWinner]: 1 },
    });
  });

  test("counts an entry saved with another time as missing from both sides", () => {
    const retimed = makeDeployedFile({ time: 2000 });

    expect(
      compareManifestFiles(
        new Map([[DEFAULT_TYPE, [retimed]]]),
        new Map([[DEFAULT_TYPE, [{ ...retimed, time: 1000 }]]]),
      ),
    ).toEqual({
      verdict: "fail",
      counts: {
        ...NO_MISMATCHES,
        [ReasonCode.MissingFromLockfile]: 1,
        [ReasonCode.MissingFromDeploy]: 1,
      },
    });
  });
});
