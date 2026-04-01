import { describe, expect, it } from "vitest";

import {
  buildCyberpunkHealthCheckResult,
  type ICyberpunkDiagnosticPayload,
  buildCyberpunkRequirementGroups,
  isCyberpunkRequirement,
  makeCyberpunkRequirementUid,
  toCyberpunkRequirement,
  toCyberpunkRequirementsList,
} from "./cyberpunk";

const requiredBy = {
  modId: 12345,
  modName: "Example Mod",
  modUrl: "https://www.nexusmods.com/cyberpunk2077/mods/12345",
};

const makeDependency = (
  overrides: Partial<ICyberpunkDiagnosticPayload> = {},
): ICyberpunkDiagnosticPayload => ({
  id: "cp-missing-codeware",
  kind: "missing-dependency",
  severity: "warning" as const,
  title: "Missing Codeware",
  message: "Codeware is required",
  fixType: "nexus-dependency" as const,
  requiredBy,
  requiredByModId: "mod-1",
  dependency: {
    gameId: "cyberpunk2077",
    modId: 9876,
    modName: "Codeware",
    modUrl: "https://www.nexusmods.com/cyberpunk2077/mods/9876",
    fileId: 42,
  },
  ...overrides,
});

describe("cyberpunk health check helpers", () => {
  it("converts fixable diagnostics into mod requirements", () => {
    const requirement = toCyberpunkRequirement(makeDependency());

    expect(requirement).toMatchObject({
      uid: makeCyberpunkRequirementUid("cp-missing-codeware"),
      id: makeCyberpunkRequirementUid("cp-missing-codeware"),
      modId: 9876,
      modName: "Codeware",
      gameId: "cyberpunk2077",
      modUrl: "https://www.nexusmods.com/cyberpunk2077/mods/9876",
      requiredBy,
    });
  });

  it("groups fixable diagnostics by requiring mod and ignores non-fixable items", () => {
    const groups = buildCyberpunkRequirementGroups([
      makeDependency(),
      makeDependency({
        id: "cp-missing-tweakxl",
        title: "Missing TweakXL",
        message: "TweakXL is required",
        dependency: {
          gameId: "cyberpunk2077",
          modId: 2468,
          modName: "TweakXL",
          modUrl: "https://www.nexusmods.com/cyberpunk2077/mods/2468",
        },
      }),
      makeDependency({
        id: "cp-guidance",
        kind: "guidance",
        severity: "info",
        fixType: "guided",
        dependency: undefined,
      }),
    ]);

    expect(Object.keys(groups)).toEqual(["mod-1"]);
    expect(groups["mod-1"].missingMods).toHaveLength(2);
  });

  it("summarizes the diagnostics result with fix availability", () => {
    const result = buildCyberpunkHealthCheckResult(
      [makeDependency()],
      "cyberpunk2077",
    );

    expect(result).toMatchObject({
      checkId: "check-cyberpunk-diagnostics",
      status: "warning",
      severity: "warning",
      fixAvailable: true,
      metadata: {
        gameId: "cyberpunk2077",
      },
    });
    expect(toCyberpunkRequirementsList(result)).toHaveLength(1);
  });

  it("recognizes cyberpunk-mapped requirements by uid prefix", () => {
    const requirement = toCyberpunkRequirement(makeDependency());

    expect(isCyberpunkRequirement(requirement)).toBe(true);
    expect(isCyberpunkRequirement(undefined)).toBe(false);
  });
});
