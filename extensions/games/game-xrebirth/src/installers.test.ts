import path from "node:path";

import { setReadFileResolver } from "@vortex/extension-test-mocks";
import { describe, expect, it, beforeEach } from "vitest";

import {
  XREBIRTH_GAME_ID,
  XREBIRTH_INSTALLER_SPECS,
  XREBIRTH_MOD_TYPES,
  installContentXml,
  testContentXml,
} from "./installers";

function specById(id: string) {
  const spec = XREBIRTH_INSTALLER_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`no spec with id=${id}`);
  return spec;
}

// Mirror of installerHelpers.ts evaluateMatch — kept tiny on purpose so the
// tests exercise each spec's match config without depending on the renderer
// runtime. `stopPatterns` is excluded because it's delegated to the framework
// and validated by installerHelpers.test.ts.
function evaluateMatch(spec: ReturnType<typeof specById>, files: string[]): boolean {
  const dataFiles = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
  const match = spec.match;
  switch (match.kind) {
    case "extensions": {
      const lower = match.list.map((e) => e.toLowerCase());
      const test = (f: string) => lower.some((ext) => f.toLowerCase().endsWith(ext));
      return match.mode === "all" ? dataFiles.every(test) : dataFiles.some(test);
    }
    case "regex": {
      const test = (f: string) => match.patterns.some((re) => re.test(f));
      return match.mode === "all" ? dataFiles.every(test) : dataFiles.some(test);
    }
    case "custom":
      return match.predicate(files);
    default:
      throw new Error(`unexpected match kind ${(match as { kind: string }).kind}`);
  }
}

describe("XREBIRTH_INSTALLER_SPECS — shape", () => {
  it("declares six specs in ascending priority order", () => {
    expect(XREBIRTH_INSTALLER_SPECS.map((s) => s.id)).toEqual([
      "savegame",
      "shader-injector",
      "utility",
      "dropin",
      "save-patch",
      "documentation",
    ]);
    const priorities = XREBIRTH_INSTALLER_SPECS.map((s) => s.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it("every spec emits a setmodtype from XREBIRTH_MOD_TYPES", () => {
    const declared = new Set(Object.values(XREBIRTH_MOD_TYPES));
    for (const spec of XREBIRTH_INSTALLER_SPECS) {
      expect(spec.modType).toBeDefined();
      expect(declared.has(spec.modType as never)).toBe(true);
    }
  });
});

describe("XREBIRTH_INSTALLER_SPECS — savegame", () => {
  const spec = specById("savegame");

  it.each([["save_001.xml"], ["save_999.xml"], ["quicksave.xml"], ["nested/save_42.xml"]])(
    "matches %s",
    (file) => {
      expect(evaluateMatch(spec, [file])).toBe(true);
    },
  );

  it.each([
    ["content.xml"],
    ["save_001.txt"],
    ["notasave_001.xml"],
    ["save.xml"],
    ["savefoo_1.xml"],
  ])("rejects %s", (file) => {
    expect(evaluateMatch(spec, [file])).toBe(false);
  });
});

describe("XREBIRTH_INSTALLER_SPECS — shader-injector", () => {
  const spec = specById("shader-injector");

  it.each([
    ["d3d9.dll"],
    ["dxgi.dll"],
    ["d3d9.ini"],
    ["SweetFX/Shaders/foo.fx"],
    ["SweetFX_settings.txt"],
    ["reshade-shaders/Shaders/SMAA.fx"],
    ["ReShade/foo.ini"],
  ])("matches %s", (file) => {
    expect(evaluateMatch(spec, [file])).toBe(true);
  });

  it.each([["readme.txt"], ["content.xml"], ["bin/Game.exe"]])("rejects %s", (file) => {
    expect(evaluateMatch(spec, [file])).toBe(false);
  });
});

describe("XREBIRTH_INSTALLER_SPECS — utility", () => {
  const spec = specById("utility");

  it("matches archives containing any .exe", () => {
    expect(evaluateMatch(spec, ["tool.exe", "readme.txt"])).toBe(true);
    expect(evaluateMatch(spec, ["nested/dir/tool.EXE"])).toBe(true);
  });

  it("rejects archives without an .exe", () => {
    expect(evaluateMatch(spec, ["content.xml", "data.cat"])).toBe(false);
  });
});

describe("XREBIRTH_INSTALLER_SPECS — dropin", () => {
  const spec = specById("dropin");

  it("uses the stopPatterns matcher (delegated to framework)", () => {
    expect(spec.match.kind).toBe("stopPatterns");
    expect(spec.install.stripCommonRoot).toBe(true);
  });
});

describe("XREBIRTH_INSTALLER_SPECS — save-patch", () => {
  const spec = specById("save-patch");

  it("accepts archives with only .xml + .txt and at least one .xml", () => {
    expect(evaluateMatch(spec, ["patch.xml", "notes.txt"])).toBe(true);
    expect(evaluateMatch(spec, ["a.xml", "b.xml"])).toBe(true);
  });

  it("rejects archives missing an .xml file", () => {
    expect(evaluateMatch(spec, ["a.txt", "b.txt"])).toBe(false);
  });

  it("rejects archives with non-xml/txt files", () => {
    expect(evaluateMatch(spec, ["a.xml", "b.dat"])).toBe(false);
  });

  it("rejects empty archives", () => {
    expect(evaluateMatch(spec, [])).toBe(false);
  });

  it("ignores directory entries when judging emptiness", () => {
    expect(evaluateMatch(spec, ["dir/"])).toBe(false);
  });
});

describe("XREBIRTH_INSTALLER_SPECS — documentation", () => {
  const spec = specById("documentation");

  it("accepts archives where every file is a doc extension", () => {
    expect(evaluateMatch(spec, ["readme.md", "screenshots/preview.png"])).toBe(true);
  });

  it("rejects archives with any non-doc file", () => {
    expect(evaluateMatch(spec, ["readme.md", "patch.xml"])).toBe(false);
  });
});

describe("testContentXml", () => {
  it("returns supported=false for wrong gameId", async () => {
    const result = await testContentXml(["content.xml"], "skyrim");
    expect(result).toEqual({ supported: false, requiredFiles: [] });
  });

  it("returns supported=true with content.xml at the root", async () => {
    const result = await testContentXml(["content.xml", "extras/x.txt"], XREBIRTH_GAME_ID);
    expect(result.supported).toBe(true);
    expect(result.requiredFiles).toEqual(["content.xml"]);
  });

  it("finds a nested content.xml", async () => {
    const result = await testContentXml(
      ["wrap/mod/content.xml", "wrap/mod/data.cat"],
      XREBIRTH_GAME_ID,
    );
    expect(result.supported).toBe(true);
    expect(result.requiredFiles).toEqual(["wrap/mod/content.xml"]);
  });

  it("rejects archives without a content.xml", async () => {
    const result = await testContentXml(["data.cat", "data.dat"], XREBIRTH_GAME_ID);
    expect(result).toEqual({ supported: false, requiredFiles: [] });
  });
});

describe("installContentXml", () => {
  beforeEach(() => {
    setReadFileResolver(async () => Buffer.alloc(0));
  });

  it("emits attribute + copy instructions for a well-formed content.xml", async () => {
    setReadFileResolver(
      async () =>
        '<?xml version="1.0"?>' +
        '<content id="my-mod" name="  My Mod " description="A test" ' +
        'save="true" author="me" version="1.0" />',
    );

    const result = await installContentXml(
      ["wrap/content.xml", "wrap/data.cat", "wrap/dir/"],
      "/install/dest",
    );

    expect(result.instructions).toContainEqual({
      type: "attribute",
      key: "customFileName",
      value: "My Mod",
    });
    expect(result.instructions).toContainEqual({ type: "attribute", key: "sticky", value: true });
    expect(result.instructions).toContainEqual({ type: "attribute", key: "author", value: "me" });

    const copyInstructions = result.instructions.filter((i) => i.type === "copy");
    expect(copyInstructions).toEqual([
      {
        type: "copy",
        source: "wrap/content.xml",
        destination: path.join("my-mod", "content.xml"),
      },
      {
        type: "copy",
        source: "wrap/data.cat",
        destination: path.join("my-mod", "data.cat"),
      },
    ]);
  });

  it("throws DataInvalid for malformed XML", async () => {
    setReadFileResolver(async () => "<<<not xml>>>");
    await expect(installContentXml(["content.xml"], "/dest")).rejects.toMatchObject({
      name: "DataInvalid",
    });
  });

  it("throws DataInvalid when content.xml has no id attribute", async () => {
    setReadFileResolver(async () => '<?xml version="1.0"?><content name="anon" />');
    await expect(installContentXml(["content.xml"], "/dest")).rejects.toMatchObject({
      name: "DataInvalid",
    });
  });
});
