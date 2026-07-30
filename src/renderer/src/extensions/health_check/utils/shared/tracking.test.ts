import { describe, expect, it } from "vitest";

import type { IDownloadedFile, IInstalledFile } from "../fileRequirements/installedFiles";
import type {
  IFileRequirementCandidate,
  IFileRequirement,
} from "../fileRequirements/mapRequirementsReport";
import {
  branchRequirementState,
  issueTypeForCheck,
  requirementStateFor,
  resolutionTypeForCategory,
  sharedRequirementState,
} from "./tracking";

const candidate = {} as IFileRequirementCandidate;
const installed = {} as IInstalledFile;
const downloaded = {} as IDownloadedFile;

describe("issueTypeForCheck", () => {
  it("maps the file-level check to warning", () => {
    expect(issueTypeForCheck("check-file-level-requirements")).toBe("warning");
  });

  it("maps the mod-level check to suggestion", () => {
    expect(issueTypeForCheck("check-nexus-mod-requirements")).toBe("suggestion");
  });
});

describe("resolutionTypeForCategory", () => {
  it.each([
    ["download", "install"],
    ["install-uninstalled", "install"],
    ["toggle", "enable"],
    ["or", "pick"],
    ["download-replace", "update"],
  ] as const)("maps %s to %s", (category, expected) => {
    expect(resolutionTypeForCategory(category)).toBe(expected);
  });
});

describe("requirementStateFor", () => {
  it.each([
    [{ kind: "missing", requirementDefId: "d", candidate }, "missing"],
    [
      {
        kind: "wrong-version-installed",
        requirementDefId: "d",
        installedFile: installed,
        candidate,
      },
      "wrong_version_enabled",
    ],
    [
      { kind: "correct-version-uninstalled", requirementDefId: "d", uninstalledFile: downloaded },
      "downloaded",
    ],
    [
      {
        kind: "correct-version-uninstalled",
        requirementDefId: "d",
        uninstalledFile: downloaded,
        enabledFile: installed,
      },
      "downloaded_wrong_enabled",
    ],
    [
      {
        kind: "wrong-version-enabled",
        requirementDefId: "d",
        enabledFile: installed,
        correctFile: installed,
      },
      "disabled_wrong_enabled",
    ],
  ] as const)("maps a $0.kind requirement", (requirement, expected) => {
    expect(requirementStateFor(requirement)).toBe(expected);
  });
});

describe("branchRequirementState", () => {
  it("separates a plain download from one that replaces an enabled wrong version", () => {
    const download = { kind: "download", modFileId: "g", candidate } as const;

    expect(branchRequirementState(download)).toBe("missing");
    expect(branchRequirementState({ ...download, enabledFile: installed })).toBe(
      "wrong_version_enabled",
    );
  });

  it("separates an install and an enable from their switch variants", () => {
    const install = { kind: "install", modFileId: "g", uninstalledFile: downloaded } as const;
    const enable = { kind: "enable", modFileId: "g", correctFile: installed } as const;

    expect(branchRequirementState(install)).toBe("downloaded");
    expect(branchRequirementState({ ...install, enabledFile: installed })).toBe(
      "downloaded_wrong_enabled",
    );
    expect(branchRequirementState(enable)).toBe("disabled");
    expect(branchRequirementState({ ...enable, enabledFile: installed })).toBe(
      "disabled_wrong_enabled",
    );
  });
});

describe("sharedRequirementState", () => {
  const missing: IFileRequirement = { kind: "missing", requirementDefId: "a", candidate };
  const or: IFileRequirement = { kind: "or", requirementDefId: "b", branches: [] };
  const downloadedReq: IFileRequirement = {
    kind: "correct-version-uninstalled",
    requirementDefId: "c",
    uninstalledFile: downloaded,
  };

  it("reports the state a group's items share", () => {
    expect(sharedRequirementState([missing, { ...missing, requirementDefId: "a2" }])).toBe(
      "missing",
    );
  });

  it("reports nothing for an empty, mixed or OR group, rather than one item's state", () => {
    expect(sharedRequirementState([])).toBeUndefined();
    expect(sharedRequirementState([missing, downloadedReq])).toBeUndefined();
    expect(sharedRequirementState([or])).toBeUndefined();
    expect(sharedRequirementState([missing, or])).toBeUndefined();
  });
});
