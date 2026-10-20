import * as nodeFs from "node:fs";
import * as path from "node:path";

import { expect } from "vitest";

import { makeDeployedFile } from "../../test-utils/builders";
import { test } from "../../test-utils/deploymentTest";

// Windows file systems fold case themselves; these cover case-sensitive ones
const caseSensitiveTest = test.skipIf(process.platform === "win32");

caseSensitiveTest(
  "deploys only the later mod's file when two mods ship it with different case",
  async ({ makeDeployment }) => {
    const h = makeDeployment({
      files: { "Textures/a.dds": "first" },
      otherMods: { Other: { "textures/A.dds": "second" } },
    });

    const deployed = await h.deployMod("Other", await h.deploy());

    expect(nodeFs.existsSync(path.join(h.gameDir, "Textures", "a.dds"))).toBe(false);
    expect(nodeFs.readFileSync(path.join(h.gameDir, "textures", "A.dds"), "utf8")).toBe("second");
    expect(deployed.map((file) => file.source)).toEqual(["Other"]);
  },
);

caseSensitiveTest(
  "removes a case variant an earlier deployment left next to the winning file",
  async ({ makeDeployment }) => {
    const h = makeDeployment({
      files: { "Textures/a.dds": "first" },
      otherMods: { Other: { "textures/A.dds": "second" } },
    });
    const first = await h.deploy();
    nodeFs.mkdirSync(path.join(h.gameDir, "textures"));
    nodeFs.linkSync(
      path.join(h.modDir("Other"), "textures", "A.dds"),
      path.join(h.gameDir, "textures", "A.dds"),
    );
    const legacy = [...first, makeDeployedFile({ relPath: "textures/A.dds", source: "Other" })];

    const deployed = await h.deployAll(["SomeMod", "Other"], legacy);

    expect(nodeFs.existsSync(path.join(h.gameDir, "Textures", "a.dds"))).toBe(false);
    expect(nodeFs.readFileSync(path.join(h.gameDir, "textures", "A.dds"), "utf8")).toBe("second");
    expect(deployed.map((file) => file.source)).toEqual(["Other"]);
  },
);
