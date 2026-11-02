import { NexusFileId } from "@nexusmods/mod-pipeline";
import { describe, expect, test } from "vitest";

import {
  makeGeneratedFileSource,
  makeLockfile,
  makeNexusFileSource,
} from "../../../test-utils/lockfileBuilders";
import { compareWithDeployment, ReasonCode } from "./shadowComparison";

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
