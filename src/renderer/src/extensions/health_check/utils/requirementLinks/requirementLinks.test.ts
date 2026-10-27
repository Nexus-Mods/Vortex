import type { IModRequirements } from "@nexusmods/nexus-api";
import { describe, expect, it } from "vitest";

import type { IMod, IModRule } from "@/extensions/mod_management/types/IMod";
import { testModReference } from "@/extensions/mod_management/util/testModReference";

import {
  findMissingRequirements,
  findRequirementLinks,
  IGNORED_REQUIREMENTS_ATTRIBUTE,
  type IFindRequirementLinksInput,
  type INexusRequirementNode,
  type IRequirementFile,
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
    fileRequirements: new Map(),
    uidOf: (mod) => `uid-${mod.attributes.modId}`,
    fileUidOf: (mod) => `file-${mod.attributes.fileId}`,
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

  it("starts a new requirement as neither linked nor ignored", () => {
    const [link] = findRequirementLinks(setup());

    expect(link.current).toBeUndefined();
    expect(link.rule).toBeUndefined();
  });

  it("shows a requirement already linked as linked, with the rule that links it", () => {
    const input = setup();
    const rule = makeRequirementRule(findRequirementLinks(input)[0], input.mods.cet, "recommends");
    input.mods.settings = { ...input.mods.settings, rules: [rule] };

    expect(findRequirementLinks(input)).toEqual([
      expect.objectContaining({ current: "recommends", rule }),
    ]);
  });

  it("shows a requirement the user ignored as ignored", () => {
    const input = setup();
    input.mods.settings = {
      ...input.mods.settings,
      attributes: {
        ...input.mods.settings.attributes,
        [IGNORED_REQUIREMENTS_ATTRIBUTE]: ["uid-107"],
      },
    };

    expect(findRequirementLinks(input)[0].current).toBe("ignore");
  });

  it("takes a requirement with only an ordering rule as new", () => {
    const input = setup();
    const after: IModRule = { type: "after", reference: { id: "cet" } };
    input.mods.settings = { ...input.mods.settings, rules: [after] };

    expect(findRequirementLinks(input)[0].current).toBeUndefined();
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

/** An acceptable file, by the UID `fileUidOf` gives: a mod's file id is ten times its mod id. */
const requiredFile = (
  fileUid: string,
  extra: Partial<IRequirementFile> = {},
): IRequirementFile => ({
  fileUid,
  modUid: `uid-${Number(fileUid.replace("file-", "")) / 10}`,
  position: 0,
  ...extra,
});

/** NativeSettings' file requires one of the given files, and lists nothing on its mod page. */
const requiringFiles = (
  files: Array<string | IRequirementFile>,
  overrides: Partial<IFindRequirementLinksInput> = {},
) =>
  setup({
    requirements: withRequirements([]),
    fileRequirements: new Map([
      [
        "settings",
        [
          {
            definitionId: "def-1",
            files: files.map((file) => (typeof file === "string" ? requiredFile(file) : file)),
          },
        ],
      ],
    ]),
    ...overrides,
  });

describe("findRequirementLinks, for file-level requirements", () => {
  it("links a requirement that an installed file satisfies", () => {
    const links = findRequirementLinks(requiringFiles(["file-1070"]));

    expect(links).toEqual([
      expect.objectContaining({
        sourceModId: "settings",
        targetModId: "cet",
        targetUid: "uid-107",
      }),
    ]);
    expect(links[0].notes).toBeUndefined();
  });

  it("leaves out a requirement none of whose files are installed", () => {
    expect(findRequirementLinks(requiringFiles(["file-5", "file-6"]))).toEqual([]);
  });

  it("links whichever alternative is installed, an enabled one first", () => {
    const input = requiringFiles(["file-1070", "file-23800"], {
      isEnabled: (modId) => modId === "red4ext",
    });
    input.mods = { ...input.mods, red4ext: nexusMod("red4ext", 2380) };

    expect(findRequirementLinks(input).map((link) => link.targetModId)).toEqual(["red4ext"]);
  });

  it("links a mod required both ways once, with its mod page note", () => {
    const links = findRequirementLinks(
      requiringFiles(["file-1070"], {
        requirements: withRequirements([requirement(107, { notes: "Needed for UI" })]),
      }),
    );

    expect(links).toHaveLength(1);
    expect(links[0].notes).toBe("Needed for UI");
  });

  it("shows a requirement already linked as linked", () => {
    const input = requiringFiles(["file-1070"]);
    const rule = makeRequirementRule(findRequirementLinks(input)[0], input.mods.cet, "requires");
    input.mods.settings = { ...input.mods.settings, rules: [rule] };

    expect(findRequirementLinks(input)).toEqual([
      expect.objectContaining({ current: "requires", rule }),
    ]);
  });
});

describe("findMissingRequirements", () => {
  it("lists a mod page requirement that nothing installed satisfies, with its note", () => {
    const missing = findMissingRequirements(
      setup({ requirements: withRequirements([requirement(999, { notes: " Needed " })]) }),
    );

    expect(missing).toEqual([
      expect.objectContaining({
        sourceModId: "settings",
        options: [{ modName: "Nexus mod 999" }],
        notes: "Needed",
      }),
    ]);
  });

  it("leaves out installed and external requirements", () => {
    const missing = findMissingRequirements(
      setup({
        requirements: withRequirements([
          requirement(107),
          requirement(999, { externalRequirement: true }),
        ]),
      }),
    );

    expect(missing).toEqual([]);
  });

  it("lists a file-level requirement with its newest file and the versions it accepts", () => {
    const missing = findMissingRequirements(
      requiringFiles([
        requiredFile("file-9990", {
          position: 2,
          fileName: "Tool 1.2",
          version: "1.2",
          modName: "Tool",
        }),
        // an older version of the same file
        requiredFile("file-9991", {
          modUid: "uid-999",
          position: 1,
          version: "1.1",
          modName: "Tool",
        }),
      ]),
    );

    expect(missing).toEqual([
      expect.objectContaining({
        options: [
          { modName: "Tool", fileName: "Tool 1.2", versions: { oldest: "1.1", newest: "1.2" } },
        ],
      }),
    ]);
  });

  it("lists each alternative of a file-level requirement", () => {
    const missing = findMissingRequirements(
      requiringFiles([
        requiredFile("file-9990", { modName: "Tool" }),
        requiredFile("file-8880", { modName: "Other tool" }),
      ]),
    );

    expect(missing[0].options.map((option) => option.modName)).toEqual(["Tool", "Other tool"]);
  });

  it("leaves out a file-level requirement whose mod is installed in another version", () => {
    expect(
      findMissingRequirements(requiringFiles([requiredFile("file-5", { modUid: "uid-107" })])),
    ).toEqual([]);
  });

  it("lists a mod required both ways once, with the page's note and the file's versions", () => {
    const missing = findMissingRequirements(
      requiringFiles(
        [requiredFile("file-9990", { version: "1.0", modName: "Tool", fileName: "Tool 1.0" })],
        { requirements: withRequirements([requirement(999, { notes: "Needed" })]) },
      ),
    );

    expect(missing).toHaveLength(1);
    expect(missing[0].notes).toBe("Needed");
    expect(missing[0].options[0].fileName).toBe("Tool 1.0");
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
