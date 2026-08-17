import type {
  Candidate,
  DependencyBranch,
  FileRequirementsReport,
} from "@nexusmods/file-dependency-resolver";
import { describe, expect, it } from "vitest";

import { VORTEX_MOD_UID } from "@/extensions/nexus_integration/util/UIDs";

import { mapRequirementsReport, type HydrateFile } from "./mapRequirementsReport";

const noopHydrate: HydrateFile = () => undefined;

const emptyBranch = {
  satisfyingEnabled: [],
  satisfyingDisabled: [],
  satisfyingUninstalled: [],
  wrongEnabled: [],
  wrongDisabled: [],
};

function candidate(modUid: string, modFileId: string): Candidate {
  return {
    fileVersionUid: `${modUid}-file`,
    modUid,
    modFileId,
    category: 1,
    position: "1",
    fileName: "file.zip",
    version: "1.0",
    modName: "Some Mod",
    adultContent: false,
  };
}

function report(branches: DependencyBranch[]): FileRequirementsReport {
  return {
    sources: [
      {
        sourceFileVersionUid: "source-uid",
        dependencies: [{ definitionId: "req-1", branches }],
      },
    ],
  };
}

describe("mapRequirementsReport", () => {
  it("drops a dependency whose only branch targets the Vortex mod page", () => {
    const branch: DependencyBranch = {
      ...emptyBranch,
      modFileId: "group-1",
      recommended: candidate(VORTEX_MOD_UID, "group-1"),
    };

    const result = mapRequirementsReport(report([branch]), noopHydrate, {
      gameId: "skyrimse",
      modsChecked: 1,
      errors: [],
    });

    expect(result.fileRequirements).toEqual({});
  });

  it("drops the whole OR when one alternative targets the Vortex mod page", () => {
    const realAlternative: DependencyBranch = {
      ...emptyBranch,
      modFileId: "group-1",
      recommended: candidate("other-mod-uid", "group-1"),
    };
    const vortexAlternative: DependencyBranch = {
      ...emptyBranch,
      modFileId: "group-2",
      recommended: candidate(VORTEX_MOD_UID, "group-2"),
    };

    const result = mapRequirementsReport(
      report([realAlternative, vortexAlternative]),
      noopHydrate,
      {
        gameId: "skyrimse",
        modsChecked: 1,
        errors: [],
      },
    );

    expect(result.fileRequirements).toEqual({});
  });

  it("still surfaces a missing requirement that does not target the Vortex mod page", () => {
    const branch: DependencyBranch = {
      ...emptyBranch,
      modFileId: "group-1",
      recommended: candidate("other-mod-uid", "group-1"),
    };

    const result = mapRequirementsReport(report([branch]), noopHydrate, {
      gameId: "skyrimse",
      modsChecked: 1,
      errors: [],
    });

    expect(result.fileRequirements["source-uid"]?.requirements).toEqual([
      {
        kind: "missing",
        requirementDefId: "req-1",
        candidate: expect.objectContaining({ modUID: "other-mod-uid" }),
      },
    ]);
  });
});
