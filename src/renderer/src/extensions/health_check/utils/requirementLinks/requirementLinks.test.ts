import type { IModRequirements } from "@nexusmods/nexus-api";
import { describe, expect, it } from "vitest";

import type { IMod, IModRule } from "@/extensions/mod_management/types/IMod";
import { testModReference } from "@/extensions/mod_management/util/testModReference";

import {
  findRequirementLinks,
  type IFindRequirementLinksInput,
  type INexusRequirementNode,
  makeRequirementRule,
} from "./requirementLinks";

const nexusMod = (id: string, nexusModId: number, extra: Partial<IMod> = {}): IMod => ({
  id,
  state: "installed",
  type: "",
  installationPath: id,
  attributes: {
    source: "nexus",
    modId: nexusModId,
    fileId: nexusModId * 10,
    downloadGame: "cyberpunk2077",
    name: id,
    version: "1.0.0",
    fileName: `${id}-${nexusModId}-1-0.zip`,
  },
  ...extra,
});

const requirement = (
  modId: number,
  extra: Partial<INexusRequirementNode> = {},
): INexusRequirementNode =>
  ({
    id: `req-${modId}`,
    modId: String(modId),
    modName: `Nexus mod ${modId}`,
    externalRequirement: false,
    ...extra,
  }) as INexusRequirementNode;

/** NativeSettings' (3518) requirements, as the query returns them. */
const withRequirements = (nodes: INexusRequirementNode[]): Map<string, Partial<IModRequirements>> =>
  new Map([
    [
      "uid-3518",
      { nexusRequirements: { nodes, nodesCount: nodes.length, totalCount: nodes.length } },
    ],
  ]);

/** NativeSettings (3518) requires CET (107); both installed and enabled. */
const setup = (overrides: Partial<IFindRequirementLinksInput> = {}): IFindRequirementLinksInput => {
  const mods = {
    settings: nexusMod("settings", 3518),
    cet: nexusMod("cet", 107),
  };
  return {
    mods,
    sourceModIds: ["settings"],
    requirements: withRequirements([requirement(107)]),
    uidOf: (mod) => `uid-${mod.attributes.modId}`,
    requirementUidOf: (req) => `uid-${req.modId}`,
    isCollectionManaged: () => false,
    isEnabled: () => true,
    gameId: "cyberpunk2077",
    ...overrides,
  };
};

describe("findRequirementLinks", () => {
  it("links a requirement that an installed mod satisfies", () => {
    const links = findRequirementLinks(setup());

    expect(links).toEqual([
      expect.objectContaining({
        sourceModId: "settings",
        targetModId: "cet",
        targetUid: "uid-107",
      }),
    ]);
  });

  it("carries the author's note, trimmed, and drops a blank one", () => {
    const noted = findRequirementLinks(
      setup({ requirements: withRequirements([requirement(107, { notes: "  Needed for UI  " })]) }),
    );
    const blank = findRequirementLinks(
      setup({ requirements: withRequirements([requirement(107, { notes: "   " })]) }),
    );

    expect(noted[0].notes).toBe("Needed for UI");
    expect(blank[0].notes).toBeUndefined();
  });

  it("leaves out external requirements, ones not installed and the mod itself", () => {
    const links = findRequirementLinks(
      setup({
        requirements: withRequirements([
          requirement(107, { externalRequirement: true }),
          requirement(999),
          requirement(3518),
        ]),
      }),
    );

    expect(links).toEqual([]);
  });

  it("leaves out a requirement already linked by a requires or recommends rule", () => {
    const input = setup();
    const rule = makeRequirementRule(findRequirementLinks(input)[0], input.mods.cet, "recommends");
    input.mods.settings = { ...input.mods.settings, rules: [rule] };

    expect(findRequirementLinks(input)).toEqual([]);
  });

  it("still links a requirement that only has an ordering rule", () => {
    const input = setup();
    const after: IModRule = { type: "after", reference: { id: "cet" } };
    input.mods.settings = { ...input.mods.settings, rules: [after] };

    expect(findRequirementLinks(input)).toHaveLength(1);
  });

  it("skips collection-managed and non-Nexus mods", () => {
    const managed = setup({ isCollectionManaged: (mod) => mod.id === "settings" });
    const local = setup();
    local.mods.settings = {
      ...local.mods.settings,
      attributes: { ...local.mods.settings.attributes, source: undefined },
    };

    expect(findRequirementLinks(managed)).toEqual([]);
    expect(findRequirementLinks(local)).toEqual([]);
  });

  it("prefers an enabled copy of the required mod", () => {
    const input = setup({ isEnabled: (modId) => modId === "cet-new" });
    input.mods = { ...input.mods, "cet-new": nexusMod("cet-new", 107) };

    expect(findRequirementLinks(input)[0].targetModId).toBe("cet-new");
  });

  it("lists a requirement once per mod, however often it's listed or selected", () => {
    const links = findRequirementLinks(
      setup({
        sourceModIds: ["settings", "settings"],
        requirements: withRequirements([requirement(107), requirement(107)]),
      }),
    );

    expect(links).toHaveLength(1);
  });
});

describe("makeRequirementRule", () => {
  const input = setup();
  const link = findRequirementLinks(input)[0];

  it("makes a rule of the chosen type, with the note as its comment", () => {
    const rule = makeRequirementRule(
      { ...link, notes: "Needed for UI" },
      input.mods.cet,
      "requires",
    );

    expect(rule.type).toBe("requires");
    expect(rule.comment).toBe("Needed for UI");
    expect(rule.reference.description).toBe(link.targetName);
  });

  it("is fulfilled by the required mod, and still after it updates to another file", () => {
    const rule = makeRequirementRule(link, input.mods.cet, "requires");
    const updated = nexusMod("cet-2", 107);
    updated.attributes = { ...updated.attributes, fileId: 9999, version: "2.0.0" };

    expect(testModReference(input.mods.cet, rule.reference)).toBe(true);
    expect(testModReference(updated, rule.reference)).toBe(true);
    expect(testModReference(input.mods.settings, rule.reference)).toBe(false);
  });
});
