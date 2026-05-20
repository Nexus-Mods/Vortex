import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import type { IInstallerSpec } from "../types/IInstallerSpec";
import {
  buildCopyInstructions,
  compileStopPatterns,
  declareInstallers,
  findCommonRootDir,
  makeInstallerFromSpec,
  matchesAnyStopPattern,
} from "./installerHelpers";

vi.mock("../../gamemode_management/util/getGame", () => ({
  getGame: vi.fn(),
}));

import { getGame } from "../../gamemode_management/util/getGame";

describe("findCommonRootDir", () => {
  test("undefined for empty list", () => {
    expect(findCommonRootDir([])).toBeUndefined();
  });

  test("undefined when files live at root", () => {
    expect(findCommonRootDir(["a.xml", "b.xml"])).toBeUndefined();
  });

  test("returns wrapping dir when all share it", () => {
    expect(findCommonRootDir(["mod/a.xml", "mod/sub/b.xml"])).toBe("mod");
  });

  test("undefined when top-level dirs differ", () => {
    expect(findCommonRootDir(["mod/a.xml", "other/b.xml"])).toBeUndefined();
  });

  test("handles backslash separators", () => {
    expect(findCommonRootDir(["mod\\a.xml", "mod\\sub\\b.xml"])).toBe("mod");
  });
});

describe("buildCopyInstructions", () => {
  test("filters out directory entries", () => {
    const sep = require("path").sep;
    const result = buildCopyInstructions([`dir${sep}`, "a.xml"], { stripCommonRoot: false });
    expect(result.instructions).toHaveLength(1);
    expect(result.instructions[0]).toMatchObject({ type: "copy", source: "a.xml" });
  });

  test("preserves paths when stripCommonRoot=false", () => {
    const result = buildCopyInstructions(["mod/a.xml", "mod/b.xml"], { stripCommonRoot: false });
    expect(result.instructions).toEqual([
      { type: "copy", source: "mod/a.xml", destination: "mod/a.xml" },
      { type: "copy", source: "mod/b.xml", destination: "mod/b.xml" },
    ]);
  });

  test("strips wrapping dir when stripCommonRoot=true", () => {
    const result = buildCopyInstructions(["mod/a.xml", "mod/sub/b.xml"], { stripCommonRoot: true });
    expect(result.instructions).toEqual([
      { type: "copy", source: "mod/a.xml", destination: "a.xml" },
      { type: "copy", source: "mod/sub/b.xml", destination: "sub/b.xml" },
    ]);
  });

  test("appends setmodtype when modType set", () => {
    const r = buildCopyInstructions(["a.xml"], { stripCommonRoot: false, modType: "my-type" });
    expect(r.instructions).toHaveLength(2);
    expect(r.instructions[1]).toEqual({ type: "setmodtype", value: "my-type" });
  });

  test("omits setmodtype when modType absent", () => {
    const r = buildCopyInstructions(["a.xml"], { stripCommonRoot: false });
    expect(r.instructions).toHaveLength(1);
  });
});

describe("compileStopPatterns", () => {
  test("compiles to case-insensitive regex", () => {
    const [re] = compileStopPatterns(["foo"]);
    expect(re!.test("FOO")).toBe(true);
    expect(re!.test("bar")).toBe(false);
  });

  test("returns empty array for empty input", () => {
    expect(compileStopPatterns([])).toEqual([]);
  });
});

describe("matchesAnyStopPattern", () => {
  beforeEach(() => {
    vi.mocked(getGame).mockReset();
  });

  test("false when game has no stopPatterns", () => {
    vi.mocked(getGame).mockReturnValue({ details: {} } as any);
    expect(matchesAnyStopPattern(["a.xml"], "xrebirth")).toBe(false);
  });

  test("false when getGame throws", () => {
    vi.mocked(getGame).mockImplementation(() => {
      throw new Error("not found");
    });
    expect(matchesAnyStopPattern(["a.xml"], "ghost")).toBe(false);
  });

  test("true when any file matches any pattern", () => {
    vi.mocked(getGame).mockReturnValue({
      details: { stopPatterns: ["[^/]*\\.cat$", "(^|/)t/[^/]+\\.xml$"] },
    } as any);
    expect(matchesAnyStopPattern(["readme.txt", "data.cat"], "xrebirth")).toBe(true);
    expect(matchesAnyStopPattern(["readme.txt"], "xrebirth")).toBe(false);
  });

  test("case-insensitive matching", () => {
    vi.mocked(getGame).mockReturnValue({
      details: { stopPatterns: ["[^/]*\\.CAT$"] },
    } as any);
    expect(matchesAnyStopPattern(["foo.cat"], "xrebirth")).toBe(true);
  });
});

describe("makeInstallerFromSpec — match.kind=extensions", () => {
  beforeEach(() => {
    vi.mocked(getGame).mockReturnValue({ details: {} } as any);
  });

  test("any mode supports if at least one file matches", async () => {
    const spec: IInstallerSpec = {
      id: "exe",
      priority: 50,
      match: { kind: "extensions", list: [".exe"], mode: "any" },
      install: { stripCommonRoot: false },
    };
    const { testSupported } = makeInstallerFromSpec(spec, "xrebirth");
    const r = await testSupported(["readme.txt", "tool.exe"], "xrebirth");
    expect(r.supported).toBe(true);
    expect(r.requiredFiles).toEqual(["tool.exe"]);
  });

  test("all mode rejects if any file fails to match", async () => {
    const spec: IInstallerSpec = {
      id: "docs",
      priority: 90,
      match: { kind: "extensions", list: [".pdf", ".md"], mode: "all" },
      install: { stripCommonRoot: false },
    };
    const { testSupported } = makeInstallerFromSpec(spec, "xrebirth");
    const r1 = await testSupported(["a.pdf", "b.md"], "xrebirth");
    const r2 = await testSupported(["a.pdf", "b.exe"], "xrebirth");
    expect(r1.supported).toBe(true);
    expect(r2.supported).toBe(false);
  });

  test("gameId guard rejects other games", async () => {
    const spec: IInstallerSpec = {
      id: "x",
      priority: 50,
      match: { kind: "extensions", list: [".exe"], mode: "any" },
      install: { stripCommonRoot: false },
    };
    const { testSupported } = makeInstallerFromSpec(spec, "xrebirth");
    const r = await testSupported(["tool.exe"], "skyrim");
    expect(r.supported).toBe(false);
  });
});

describe("makeInstallerFromSpec — match.kind=regex", () => {
  beforeEach(() => {
    vi.mocked(getGame).mockReturnValue({ details: {} } as any);
  });

  test("any mode supports first match and reports it", async () => {
    const spec: IInstallerSpec = {
      id: "save",
      priority: 60,
      match: { kind: "regex", patterns: [/save_\d+\.xml$/i], mode: "any" },
      install: { stripCommonRoot: false },
    };
    const { testSupported } = makeInstallerFromSpec(spec, "xrebirth");
    const r = await testSupported(["readme.txt", "save_001.xml"], "xrebirth");
    expect(r.supported).toBe(true);
    expect(r.requiredFiles).toEqual(["save_001.xml"]);
  });
});

describe("makeInstallerFromSpec — match.kind=filename", () => {
  beforeEach(() => {
    vi.mocked(getGame).mockReturnValue({ details: {} } as any);
  });

  test("matches by basename, case-insensitive", async () => {
    const spec: IInstallerSpec = {
      id: "manifest",
      priority: 40,
      match: { kind: "filename", names: ["manifest.json"], mode: "any" },
      install: { stripCommonRoot: false },
    };
    const { testSupported } = makeInstallerFromSpec(spec, "g");
    const r = await testSupported(["mod/MANIFEST.JSON", "other.txt"], "g");
    expect(r.supported).toBe(true);
    expect(r.requiredFiles).toEqual(["mod/MANIFEST.JSON"]);
  });
});

describe("makeInstallerFromSpec — match.kind=stopPatterns", () => {
  test("delegates to matchesAnyStopPattern", async () => {
    vi.mocked(getGame).mockReturnValue({
      details: { stopPatterns: ["[^/]*\\.cat$"] },
    } as any);
    const spec: IInstallerSpec = {
      id: "dropin",
      priority: 75,
      match: { kind: "stopPatterns" },
      install: { stripCommonRoot: true },
    };
    const { testSupported } = makeInstallerFromSpec(spec, "xrebirth");
    const r1 = await testSupported(["data.cat", "readme.txt"], "xrebirth");
    const r2 = await testSupported(["readme.txt"], "xrebirth");
    expect(r1.supported).toBe(true);
    expect(r2.supported).toBe(false);
  });
});

describe("makeInstallerFromSpec — match.kind=custom", () => {
  beforeEach(() => {
    vi.mocked(getGame).mockReturnValue({ details: {} } as any);
  });

  test("delegates to the predicate", async () => {
    const spec: IInstallerSpec = {
      id: "weird",
      priority: 99,
      match: { kind: "custom", predicate: (files) => files.length === 3 },
      install: { stripCommonRoot: false },
    };
    const { testSupported } = makeInstallerFromSpec(spec, "g");
    expect((await testSupported(["a", "b"], "g")).supported).toBe(false);
    expect((await testSupported(["a", "b", "c"], "g")).supported).toBe(true);
  });
});

describe("makeInstallerFromSpec — install behavior", () => {
  beforeEach(() => {
    vi.mocked(getGame).mockReturnValue({ details: {} } as any);
  });

  test("emits setmodtype when spec.modType set", async () => {
    const spec: IInstallerSpec = {
      id: "x",
      priority: 50,
      modType: "xrebirth-utility",
      match: { kind: "extensions", list: [".exe"], mode: "any" },
      install: { stripCommonRoot: true },
    };
    const { install } = makeInstallerFromSpec(spec, "xrebirth");
    const r = await install(["mod/tool.exe"]);
    expect(r.instructions).toEqual([
      { type: "copy", source: "mod/tool.exe", destination: "tool.exe" },
      { type: "setmodtype", value: "xrebirth-utility" },
    ]);
  });

  test("omits setmodtype when spec.modType unset", async () => {
    const spec: IInstallerSpec = {
      id: "x",
      priority: 50,
      match: { kind: "extensions", list: [".exe"], mode: "any" },
      install: { stripCommonRoot: false },
    };
    const { install } = makeInstallerFromSpec(spec, "xrebirth");
    const r = await install(["tool.exe"]);
    expect(r.instructions).toHaveLength(1);
  });
});

describe("declareInstallers", () => {
  test("calls registerInstaller per spec with correct id", () => {
    const registerInstaller = vi.fn();
    const ctx = { registerInstaller } as any;
    const specs: IInstallerSpec[] = [
      {
        id: "savegame",
        priority: 60,
        modType: "xrebirth-savegame",
        match: { kind: "extensions", list: [".xml"], mode: "any" },
        install: { stripCommonRoot: false },
      },
      {
        id: "nomodtype",
        priority: 70,
        match: { kind: "extensions", list: [".bin"], mode: "any" },
        install: { stripCommonRoot: false },
      },
    ];
    declareInstallers(ctx, "xrebirth", specs);
    expect(registerInstaller).toHaveBeenCalledTimes(2);
    expect(registerInstaller.mock.calls[0]?.[0]).toBe("xrebirth-savegame");
    expect(registerInstaller.mock.calls[0]?.[1]).toBe(60);
    expect(registerInstaller.mock.calls[1]?.[0]).toBe("xrebirth-nomodtype");
    expect(registerInstaller.mock.calls[1]?.[1]).toBe(70);
  });
});
