import path from "path";

import { afterEach, describe, expect, test, vi } from "vitest";
import { fs, util } from "vortex-api";

import init from "./index";

// Capture all registration calls
function createMockContext() {
  const games: Record<string, unknown>[] = [];
  const installers: { id: string; priority: number; test: Function; install: Function }[] = [];
  const loadOrders: Record<string, unknown>[] = [];
  const modTypes: {
    id: string;
    priority: number;
    isGameSupported: (gameId: string) => boolean;
    getInstallPath: (game: { id: string }) => string | undefined;
    test: Function;
    options?: Record<string, unknown>;
  }[] = [];
  const healthChecks: Record<string, unknown>[] = [];

  const context = {
    registerGame: vi.fn((game: Record<string, unknown>) => games.push(game)),
    registerInstaller: vi.fn(
      (id: string, priority: number, testFn: Function, installFn: Function) =>
        installers.push({ id, priority, test: testFn, install: installFn }),
    ),
    registerLoadOrder: vi.fn((info: Record<string, unknown>) => loadOrders.push(info)),
    registerModType: vi.fn(
      (
        id: string,
        priority: number,
        isGameSupported: (gameId: string) => boolean,
        getInstallPath: (game: { id: string }) => string | undefined,
        test: Function,
        options?: Record<string, unknown>,
      ) => modTypes.push({ id, priority, isGameSupported, getInstallPath, test, options }),
    ),
    registerHealthCheck: vi.fn((check: Record<string, unknown>) => healthChecks.push(check)),
    api: {
      store: {
        getState: vi.fn(() => ({})),
      },
    },
  };

  return { context, games, installers, loadOrders, modTypes, healthChecks };
}

afterEach(() => vi.clearAllMocks());

// ── Game Registration ──────────────────────────────────────────────

describe("game registration", () => {
  test("registers exactly two games", () => {
    const { context, games } = createMockContext();
    init(context as never);
    expect(games).toHaveLength(2);
  });

  test("XCOM 2 has correct identity", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const xcom2 = games[0]!;
    expect(xcom2.id).toBe("xcom2");
    expect(xcom2.name).toBe("XCOM 2");
  });

  test("WOTC has correct identity", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const wotc = games[1]!;
    expect(wotc.id).toBe("xcom2-wotc");
    expect(wotc.name).toBe("XCOM 2: War of the Chosen");
  });

  test("XCOM 2 executable resolves to Binaries/Win64/XCom2.exe", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const exe = (games[0]!.executable as Function)();
    expect(exe).toBe(path.join("Binaries", "Win64", "XCom2.exe"));
  });

  test("WOTC executable resolves under XCom2-WarOfTheChosen", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const exe = (games[1]!.executable as Function)();
    expect(exe).toBe(path.join("XCom2-WarOfTheChosen", "Binaries", "Win64", "XCom2.exe"));
  });

  test("XCOM 2 mod path is XComGame/Mods", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const modPath = (games[0]!.queryModPath as Function)();
    expect(modPath).toBe(path.join("XComGame", "Mods"));
  });

  test("WOTC mod path is XCom2-WarOfTheChosen/XComGame/Mods", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const modPath = (games[1]!.queryModPath as Function)();
    expect(modPath).toBe(path.join("XCom2-WarOfTheChosen", "XComGame", "Mods"));
  });

  test("both games share the same launch parameters", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const expected = [
      "-fromLauncher",
      "-review",
      "-noRedScreens",
      "-noStartupMovies",
      "-CrashDumpWatcher",
    ];
    expect(games[0]!.parameters).toEqual(expected);
    expect(games[1]!.parameters).toEqual(expected);
  });

  test("XCOM 2 requiredFiles include XComGame directory", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const required = games[0]!.requiredFiles as string[];
    expect(required).toContain("XComGame");
    expect(required).toContainEqual(path.join("XComGame", "CookedPCConsole", "3DUIBP.upk"));
  });

  test("WOTC requiredFiles include XCom2-WarOfTheChosen directory", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const required = games[1]!.requiredFiles as string[];
    expect(required).toContainEqual("XCom2-WarOfTheChosen");
  });

  test("both games have supportedTools with launcher and devtools", () => {
    const { context, games } = createMockContext();
    init(context as never);
    for (const game of games) {
      const tools = game.supportedTools as { id: string }[];
      expect(tools).toHaveLength(2);
      expect(tools.some((t) => t.id.endsWith("-launcher"))).toBe(true);
      expect(tools.some((t) => t.id.endsWith("-devtools"))).toBe(true);
    }
  });

  test("details include gogAppId for both games", () => {
    const { context, games } = createMockContext();
    init(context as never);
    for (const game of games) {
      expect((game.details as Record<string, unknown>).gogAppId).toBe("1482002159");
    }
  });

  test("WOTC details include nexusPageId and compatibleDownloads", () => {
    const { context, games } = createMockContext();
    init(context as never);
    const details = games[1]!.details as Record<string, unknown>;
    expect(details.nexusPageId).toBe("xcom2");
    expect(details.compatibleDownloads).toEqual(["xcom2"]);
  });
});

// ── Installer ──────────────────────────────────────────────────────

describe("installer", () => {
  function getInstaller() {
    const { context, installers } = createMockContext();
    init(context as never);
    return installers[0]!;
  }

  test("registers the canonical .XComMod installer at priority 25", () => {
    const { context, installers } = createMockContext();
    init(context as never);
    const xcomInst = installers.find((i) => i.id === "xcom2-installer");
    expect(xcomInst).toBeDefined();
    expect(xcomInst!.priority).toBe(25);
  });

  test("registers a character-pool installer per game id", () => {
    const { context, installers } = createMockContext();
    init(context as never);
    // declareInstallers is called once per game id, both reusing the same
    // modType-keyed registration id (xcom2-character-pool).
    const poolInstallers = installers.filter((i) => i.id === "xcom2-character-pool");
    expect(poolInstallers).toHaveLength(2);
    expect(poolInstallers.every((i) => i.priority === 30)).toBe(true);
  });

  test("testMod supports xcom2 game ID with XComMod file", async () => {
    const { test: testMod } = getInstaller();
    const result = await testMod(["MyMod/MyMod.XComMod", "MyMod/Content.upk"], "xcom2");
    expect(result.supported).toBe(true);
  });

  test("testMod supports xcom2-wotc game ID", async () => {
    const { test: testMod } = getInstaller();
    const result = await testMod(["MyMod/MyMod.XComMod"], "xcom2-wotc");
    expect(result.supported).toBe(true);
  });

  test("testMod rejects other game IDs", async () => {
    const { test: testMod } = getInstaller();
    const result = await testMod(["MyMod/MyMod.XComMod"], "skyrim");
    expect(result.supported).toBe(false);
  });

  test("testMod rejects archives without XComMod files", async () => {
    const { test: testMod } = getInstaller();
    const result = await testMod(["readme.txt", "Config/settings.ini"], "xcom2");
    expect(result.supported).toBe(false);
  });

  test("installMod produces copy instructions preserving mod folder structure", async () => {
    const { install } = getInstaller();
    const files = [
      "MyMod/MyMod.XComMod",
      "MyMod/Config/XComMyMod.ini",
      "MyMod/Content/Textures.upk",
    ];
    const result = await install(files);
    const copies = result.instructions.filter((i: { type: string }) => i.type === "copy");
    expect(copies.length).toBe(3);
    for (const copy of copies) {
      expect(copy.destination).toMatch(/^MyMod/);
    }
  });

  test("installMod produces xComMods attribute", async () => {
    const { install } = getInstaller();
    const files = ["ModA/ModA.XComMod", "ModA/data.upk"];
    const result = await install(files);
    const attrs = result.instructions.filter((i: { type: string }) => i.type === "attribute");
    expect(attrs).toHaveLength(1);
    expect(attrs[0].key).toBe("xComMods");
    expect(attrs[0].value).toEqual(["ModA"]);
  });

  test("installMod handles multiple mods in one archive", async () => {
    const { install } = getInstaller();
    const files = ["ModA/ModA.XComMod", "ModA/data.upk", "ModB/ModB.XComMod", "ModB/content.upk"];
    const result = await install(files);
    const attrs = result.instructions.filter((i: { type: string }) => i.type === "attribute");
    expect(attrs[0].value).toEqual(["ModA", "ModB"]);

    const copies = result.instructions.filter((i: { type: string }) => i.type === "copy");
    const destPrefixes = new Set(
      copies.map((c: { destination: string }) => c.destination.split(path.sep)[0]),
    );
    expect(destPrefixes).toEqual(new Set(["ModA", "ModB"]));
  });
});

// ── Load Order ─────────────────────────────────────────────────────

describe("load order", () => {
  function getLoadOrders() {
    const { context, loadOrders } = createMockContext();
    init(context as never);
    return loadOrders;
  }

  test("registers load order for both games", () => {
    const loadOrders = getLoadOrders();
    expect(loadOrders).toHaveLength(2);
    expect(loadOrders[0]!.gameId).toBe("xcom2");
    expect(loadOrders[1]!.gameId).toBe("xcom2-wotc");
  });

  test("both load orders have toggleable entries", () => {
    const loadOrders = getLoadOrders();
    for (const lo of loadOrders) {
      expect(lo.toggleableEntries).toBe(true);
    }
  });

  test("validate rejects entries with quote characters", async () => {
    const loadOrders = getLoadOrders();
    const validate = loadOrders[0]!.validate as Function;
    const result = await validate([], [{ id: "mod1", name: 'Mod "Bad"', enabled: true }]);
    expect(result).toBeDefined();
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].id).toBe("mod1");
  });

  test("validate accepts clean entries", async () => {
    const loadOrders = getLoadOrders();
    const validate = loadOrders[0]!.validate as Function;
    const result = await validate([], [{ id: "mod1", name: "CleanMod", enabled: true }]);
    expect(result).toBeUndefined();
  });

  test("validate accepts an empty load order", async () => {
    const loadOrders = getLoadOrders();
    const validate = loadOrders[0]!.validate as Function;
    const result = await validate([], []);
    expect(result).toBeUndefined();
  });

  test("validate flags only the bad entries in a mixed list", async () => {
    const loadOrders = getLoadOrders();
    const validate = loadOrders[0]!.validate as Function;
    const result = await validate(
      [],
      [
        { id: "ok1", name: "GoodMod", enabled: true },
        { id: "bad1", name: 'Bad "One"', enabled: true },
        { id: "ok2", name: "AnotherGood", enabled: false },
        { id: "bad2", name: '"Quoted', enabled: true },
      ],
    );
    expect(result.invalid).toHaveLength(2);
    expect(result.invalid.map((e: { id: string }) => e.id).sort()).toEqual(["bad1", "bad2"]);
    expect(result.invalid[0].reason).toBe("contains invalid characters.");
  });

  describe("deserializeLoadOrder", () => {
    test("returns mods found in the mods folder", async () => {
      const { context, loadOrders } = createMockContext();
      init(context as never);

      // Mock discovery
      vi.mocked(util.getSafe).mockReturnValue({ path: "C:\\Games\\XCOM2" });

      // Mock mods folder scan
      vi.mocked(fs.readdirAsync)
        .mockResolvedValueOnce(["ModA", "ModB"] as never) // mods folder
        .mockResolvedValue([] as never); // subsequent calls

      vi.mocked(fs.statAsync).mockImplementation((filePath: string) => {
        if (filePath.endsWith(".XComMod")) return Promise.resolve({} as never);
        return Promise.resolve({ isDirectory: () => true } as never);
      });

      // Mock empty INI
      vi.mocked(fs.readFileAsync).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      const deserialize = loadOrders[0]!.deserializeLoadOrder as Function;
      const result = await deserialize();

      expect(result).toHaveLength(2);
      expect(result.map((e: { name: string }) => e.name)).toEqual(["ModA", "ModB"]);
      expect(result.every((e: { enabled: boolean }) => e.enabled === false)).toBe(true);
    });

    test("marks mods as enabled based on INI content", async () => {
      const { context, loadOrders } = createMockContext();
      init(context as never);

      vi.mocked(util.getSafe).mockReturnValue({ path: "C:\\Games\\XCOM2" });

      vi.mocked(fs.readdirAsync)
        .mockResolvedValueOnce(["ModA", "ModB"] as never)
        .mockResolvedValue([] as never);
      vi.mocked(fs.statAsync).mockImplementation((filePath: string) => {
        if (filePath.endsWith(".XComMod")) return Promise.resolve({} as never);
        return Promise.resolve({ isDirectory: () => true } as never);
      });

      vi.mocked(fs.readFileAsync).mockResolvedValue(
        '[Engine.XComModOptions]\nActiveMods="ModA"\n' as never,
      );

      const deserialize = loadOrders[0]!.deserializeLoadOrder as Function;
      const result = await deserialize();

      const modA = result.find((e: { name: string }) => e.name === "ModA");
      const modB = result.find((e: { name: string }) => e.name === "ModB");
      expect(modA.enabled).toBe(true);
      expect(modB.enabled).toBe(false);
    });

    test("returns an empty load order when no mods are installed", async () => {
      const { context, loadOrders } = createMockContext();
      init(context as never);

      vi.mocked(util.getSafe).mockReturnValue({ path: "C:\\Games\\XCOM2" });
      vi.mocked(fs.readdirAsync).mockResolvedValue([] as never);
      vi.mocked(fs.readFileAsync).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      const deserialize = loadOrders[0]!.deserializeLoadOrder as Function;
      const result = await deserialize();
      expect(result).toEqual([]);
    });

    test("populates modId from deployed manifest when paths match", async () => {
      const { context, loadOrders } = createMockContext();
      init(context as never);

      vi.mocked(util.getSafe).mockReturnValue({ path: "C:\\Games\\XCOM2" });
      vi.mocked(fs.readdirAsync)
        .mockResolvedValueOnce(["ModA"] as never)
        .mockResolvedValue([] as never);
      vi.mocked(fs.statAsync).mockImplementation((filePath: string) => {
        if (filePath.endsWith(".XComMod")) return Promise.resolve({} as never);
        return Promise.resolve({ isDirectory: () => true } as never);
      });
      vi.mocked(fs.readFileAsync).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );
      vi.mocked(util.getManifest).mockResolvedValue({
        files: [{ relPath: path.join("ModA", "ModA.XComMod"), source: "vortex-mod-42" }],
      } as never);

      const deserialize = loadOrders[0]!.deserializeLoadOrder as Function;
      const [entry] = await deserialize();
      expect(entry.modId).toBe("vortex-mod-42");
    });

    test("picks up steam workshop mods and lowercases the steam-prefixed id", async () => {
      const { context, loadOrders } = createMockContext();
      init(context as never);

      // Steam install layout: ...\steamapps\common\XCOM 2 → workshop dir at
      // ...\steamapps\workshop\content\268500\<workshopId>\<ModName>.XComMod
      const gamePath = "C:\\Steam\\steamapps\\common\\XCOM 2";
      vi.mocked(util.getSafe).mockReturnValue({ path: gamePath });

      vi.mocked(fs.readdirAsync).mockImplementation((p: string) => {
        const s = String(p);
        // Mods folder — no local mods, only workshop.
        if (s.endsWith(path.join("XComGame", "Mods"))) return Promise.resolve([] as never);
        // Workshop content/268500 — one workshop entry directory.
        if (s.endsWith(path.join("workshop", "content", "268500"))) {
          return Promise.resolve(["1234567890"] as never);
        }
        // Inside the workshop entry — the .XComMod descriptor.
        if (s.endsWith("1234567890")) {
          return Promise.resolve(["WorkshopMod.XComMod"] as never);
        }
        return Promise.resolve([] as never);
      });
      vi.mocked(fs.statAsync).mockResolvedValue({ isDirectory: () => true } as never);
      vi.mocked(fs.readFileAsync).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      const deserialize = loadOrders[0]!.deserializeLoadOrder as Function;
      const result = await deserialize();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("WorkshopMod");
      // Regression guard: the id must be a lowercased "steam-<name>", not
      // "steam-WorkshopMod.toLowerCase()" (the literal-template-string typo).
      expect(result[0].id).toBe("steam-workshopmod");
    });
  });

  describe("serializeLoadOrder", () => {
    test("writes enabled mods to INI file", async () => {
      const { context, loadOrders } = createMockContext();
      init(context as never);

      vi.mocked(util.getSafe).mockReturnValue({ path: "C:\\Games\\XCOM2" });

      const serialize = loadOrders[0]!.serializeLoadOrder as Function;
      await serialize([
        { id: "moda", name: "ModA", enabled: true },
        { id: "modb", name: "ModB", enabled: false },
        { id: "modc", name: "ModC", enabled: true },
      ]);

      expect(fs.writeFileAsync).toHaveBeenCalledOnce();
      const [filePath, content] = vi.mocked(fs.writeFileAsync).mock.calls[0]!;
      expect(filePath).toContain("DefaultModOptions.ini");
      expect(content).toContain('ActiveMods="ModA"');
      expect(content).not.toContain("ModB");
      expect(content).toContain('ActiveMods="ModC"');
      expect(content).toContain("[Engine.XComModOptions]");
    });

    test("WOTC serializes under XCom2-WarOfTheChosen/XComGame/Config", async () => {
      const { context, loadOrders } = createMockContext();
      init(context as never);

      vi.mocked(util.getSafe).mockReturnValue({ path: "C:\\Games\\XCOM2" });

      const serialize = loadOrders[1]!.serializeLoadOrder as Function;
      await serialize([{ id: "moda", name: "ModA", enabled: true }]);

      const [filePath] = vi.mocked(fs.writeFileAsync).mock.calls[0]!;
      expect(filePath).toContain(path.join("XCom2-WarOfTheChosen", "XComGame", "Config"));
      expect(filePath).toContain("DefaultModOptions.ini");
    });

    test("empty enabled list still writes the INI header", async () => {
      const { context, loadOrders } = createMockContext();
      init(context as never);

      vi.mocked(util.getSafe).mockReturnValue({ path: "C:\\Games\\XCOM2" });

      const serialize = loadOrders[0]!.serializeLoadOrder as Function;
      await serialize([
        { id: "a", name: "Disabled1", enabled: false },
        { id: "b", name: "Disabled2", enabled: false },
      ]);

      const [, content] = vi.mocked(fs.writeFileAsync).mock.calls[0]!;
      expect(content).toContain("[Engine.XComModOptions]");
      expect(content).not.toContain('ActiveMods="Disabled1"');
      expect(content).not.toContain('ActiveMods="Disabled2"');
    });
  });
});

// ── ModType callbacks ──────────────────────────────────────────────
//
// Exercises every Vortex call point on each registerModType() entry:
//
//   isGameSupported(gameId) — gates whether this modType applies
//   getInstallPath(game)    — absolute deploy target
//
// The `test` callback (auto-classification of an existing mod into this
// modType) is left at `() => Promise.resolve(false)` in production — covered
// by a single "never auto-classifies" assertion rather than per-modType.

describe("mod types", () => {
  function getModTypes() {
    const { context, modTypes } = createMockContext();
    init(context as never);
    return modTypes;
  }

  function findModType(modTypes: ReturnType<typeof getModTypes>, id: string) {
    const mt = modTypes.find((m) => m.id === id);
    if (!mt) throw new Error(`no modType with id=${id}`);
    return mt;
  }

  test("registers three mod types: character pool, config drop-in, save", () => {
    const modTypes = getModTypes();
    expect(modTypes.map((m) => m.id).sort()).toEqual([
      "xcom2-character-pool",
      "xcom2-config-drop-in",
      "xcom2-save",
    ]);
  });

  for (const id of ["xcom2-character-pool", "xcom2-config-drop-in", "xcom2-save"]) {
    test(`${id}: isGameSupported accepts xcom2 + xcom2-wotc, rejects others`, () => {
      const mt = findModType(getModTypes(), id);
      expect(mt.isGameSupported("xcom2")).toBe(true);
      expect(mt.isGameSupported("xcom2-wotc")).toBe(true);
      expect(mt.isGameSupported("xrebirth")).toBe(false);
      expect(mt.isGameSupported("")).toBe(false);
    });

    test(`${id}: never auto-classifies existing mods`, async () => {
      const mt = findModType(getModTypes(), id);
      const verdict = await (mt.test as Function)([
        { type: "copy", source: "x", destination: "y" },
      ]);
      expect(verdict).toBe(false);
    });
  }

  describe("getInstallPath", () => {
    test("character-pool: xcom2 deploys to XComGame/CharacterPool/Importable", () => {
      const mt = findModType(getModTypes(), "xcom2-character-pool");
      vi.mocked(util.getSafe).mockReturnValue({ path: "/games/xcom2" });
      expect(mt.getInstallPath({ id: "xcom2" })).toBe(
        path.join("/games/xcom2", "XComGame", "CharacterPool", "Importable"),
      );
    });

    test("character-pool: WOTC nests under XCom2-WarOfTheChosen", () => {
      const mt = findModType(getModTypes(), "xcom2-character-pool");
      vi.mocked(util.getSafe).mockReturnValue({ path: "/games/xcom2" });
      expect(mt.getInstallPath({ id: "xcom2-wotc" })).toBe(
        path.join(
          "/games/xcom2",
          "XCom2-WarOfTheChosen",
          "XComGame",
          "CharacterPool",
          "Importable",
        ),
      );
    });

    test("character-pool: returns undefined when discovery is missing", () => {
      const mt = findModType(getModTypes(), "xcom2-character-pool");
      // util.getSafe's mock-default returns the fallback (undefined) when the
      // state path isn't overridden.
      vi.mocked(util.getSafe).mockReturnValueOnce(undefined);
      expect(mt.getInstallPath({ id: "xcom2" })).toBeUndefined();
    });

    test("config-drop-in: install path is the game's discovered root", () => {
      const mt = findModType(getModTypes(), "xcom2-config-drop-in");
      vi.mocked(util.getSafe).mockReturnValue({ path: "/games/xcom2" });
      expect(mt.getInstallPath({ id: "xcom2" })).toBe("/games/xcom2");
      expect(mt.getInstallPath({ id: "xcom2-wotc" })).toBe("/games/xcom2");
    });

    test("config-drop-in: undefined when discovery is missing", () => {
      const mt = findModType(getModTypes(), "xcom2-config-drop-in");
      vi.mocked(util.getSafe).mockReturnValueOnce(undefined);
      expect(mt.getInstallPath({ id: "xcom2" })).toBeUndefined();
    });

    test("save: xcom2 deploys to <documents>/My Games/XCOM2/XComGame/SaveData", () => {
      const mt = findModType(getModTypes(), "xcom2-save");
      vi.mocked(util.getVortexPath).mockReturnValue("/home/test/Documents");
      expect(mt.getInstallPath({ id: "xcom2" })).toBe(
        path.join("/home/test/Documents", "My Games", "XCOM2", "XComGame", "SaveData"),
      );
    });

    test("save: WOTC uses 'XCOM2 War of the Chosen' docs subdir", () => {
      const mt = findModType(getModTypes(), "xcom2-save");
      vi.mocked(util.getVortexPath).mockReturnValue("/home/test/Documents");
      expect(mt.getInstallPath({ id: "xcom2-wotc" })).toBe(
        path.join(
          "/home/test/Documents",
          "My Games",
          "XCOM2 War of the Chosen",
          "XComGame",
          "SaveData",
        ),
      );
    });
  });
});

// ── Health checks ──────────────────────────────────────────────────
//
// Each registered IModHealthCheck.checkMod is invoked at runtime by Vortex's
// health-check service per registered mod. Below: build a minimal IMod
// fixture per scenario and assert the check returns the expected status.

interface ModFixture {
  files: string[];
  attributes: Record<string, unknown>;
}

function makeMod(opts: Partial<ModFixture> = {}): ModFixture {
  return { files: [], attributes: {}, ...opts };
}

describe("health checks", () => {
  function getCheck(id: string) {
    const { context, healthChecks } = createMockContext();
    init(context as never);
    const check = healthChecks.find((c) => c.id === id);
    if (!check) throw new Error(`no health check with id=${id}`);
    return check as { checkMod: (api: unknown, mod: ModFixture) => Promise<{ status: string }> };
  }

  test("registers all five health checks", () => {
    const { context, healthChecks } = createMockContext();
    init(context as never);
    expect(healthChecks.map((c) => c.id).sort()).toEqual([
      "xcom2-character-pool-has-bin",
      "xcom2-has-xcommod-file",
      "xcom2-mod-has-files",
      "xcom2-save-deployed",
      "xcom2-xCommods-attribute-set",
    ]);
  });

  describe("xcom2-mod-has-files", () => {
    test("warns when install output is empty", async () => {
      const r = await getCheck("xcom2-mod-has-files").checkMod(undefined, makeMod());
      expect(r.status).toBe("warning");
    });

    test("passes when mod has at least one file", async () => {
      const r = await getCheck("xcom2-mod-has-files").checkMod(
        undefined,
        makeMod({ files: ["MyMod/MyMod.XComMod"] }),
      );
      expect(r.status).toBe("passed");
    });
  });

  describe("xcom2-has-xcommod-file", () => {
    test("warns when no .XComMod file is present", async () => {
      const r = await getCheck("xcom2-has-xcommod-file").checkMod(
        undefined,
        makeMod({ files: ["MyMod/Content.upk"] }),
      );
      expect(r.status).toBe("warning");
    });

    test("passes when a .XComMod file is present", async () => {
      const r = await getCheck("xcom2-has-xcommod-file").checkMod(
        undefined,
        makeMod({ files: ["MyMod/MyMod.XComMod"] }),
      );
      expect(r.status).toBe("passed");
    });

    test("skipped (passes) for character pool mods", async () => {
      const r = await getCheck("xcom2-has-xcommod-file").checkMod(
        undefined,
        makeMod({ files: ["Annette.bin"], attributes: { modType: "xcom2-character-pool" } }),
      );
      expect(r.status).toBe("passed");
      expect(r.message).toContain("not applicable");
    });

    test("skipped (passes) for save mods", async () => {
      const r = await getCheck("xcom2-has-xcommod-file").checkMod(
        undefined,
        makeMod({ files: ["save_LOST"], attributes: { modType: "xcom2-save" } }),
      );
      expect(r.status).toBe("passed");
      expect(r.message).toContain("not applicable");
    });
  });

  describe("xcom2-xCommods-attribute-set", () => {
    test("warns when attribute is missing", async () => {
      const r = await getCheck("xcom2-xCommods-attribute-set").checkMod(
        undefined,
        makeMod({ files: ["MyMod/MyMod.XComMod"] }),
      );
      expect(r.status).toBe("warning");
    });

    test("warns when attribute is an empty array", async () => {
      const r = await getCheck("xcom2-xCommods-attribute-set").checkMod(
        undefined,
        makeMod({ files: ["MyMod/MyMod.XComMod"], attributes: { xComMods: [] } }),
      );
      expect(r.status).toBe("warning");
    });

    test("passes when attribute is a non-empty array", async () => {
      const r = await getCheck("xcom2-xCommods-attribute-set").checkMod(
        undefined,
        makeMod({
          files: ["MyMod/MyMod.XComMod"],
          attributes: { xComMods: ["MyMod"] },
        }),
      );
      expect(r.status).toBe("passed");
    });

    test("skipped (passes) for character pool mods", async () => {
      const r = await getCheck("xcom2-xCommods-attribute-set").checkMod(
        undefined,
        makeMod({ files: ["Annette.bin"], attributes: { modType: "xcom2-character-pool" } }),
      );
      expect(r.status).toBe("passed");
    });
  });

  describe("xcom2-character-pool-has-bin", () => {
    test("not applicable (passes) for non-character-pool mods", async () => {
      const r = await getCheck("xcom2-character-pool-has-bin").checkMod(
        undefined,
        makeMod({ files: ["MyMod/MyMod.XComMod"] }),
      );
      expect(r.status).toBe("passed");
      expect(r.message).toContain("Not a character pool mod");
    });

    test("warns when a character-pool mod has no .bin file", async () => {
      const r = await getCheck("xcom2-character-pool-has-bin").checkMod(
        undefined,
        makeMod({ files: ["Readme.txt"], attributes: { modType: "xcom2-character-pool" } }),
      );
      expect(r.status).toBe("warning");
    });

    test("passes when a character-pool mod has at least one .bin file", async () => {
      const r = await getCheck("xcom2-character-pool-has-bin").checkMod(
        undefined,
        makeMod({ files: ["Annette.bin"], attributes: { modType: "xcom2-character-pool" } }),
      );
      expect(r.status).toBe("passed");
    });
  });

  describe("xcom2-save-deployed", () => {
    test("not applicable (passes) for non-save mods", async () => {
      const r = await getCheck("xcom2-save-deployed").checkMod(
        undefined,
        makeMod({ files: ["MyMod/MyMod.XComMod"] }),
      );
      expect(r.status).toBe("passed");
      expect(r.message).toContain("Not a save mod");
    });

    test("warns when a save mod has no save-named file", async () => {
      const r = await getCheck("xcom2-save-deployed").checkMod(
        undefined,
        makeMod({ files: ["screenshot.jpg"], attributes: { modType: "xcom2-save" } }),
      );
      expect(r.status).toBe("warning");
    });

    test("passes for a save_<name> file", async () => {
      const r = await getCheck("xcom2-save-deployed").checkMod(
        undefined,
        makeMod({ files: ["save_LOST"], attributes: { modType: "xcom2-save" } }),
      );
      expect(r.status).toBe("passed");
    });

    test("passes for save<digits>", async () => {
      const r = await getCheck("xcom2-save-deployed").checkMod(
        undefined,
        makeMod({ files: ["save14"], attributes: { modType: "xcom2-save" } }),
      );
      expect(r.status).toBe("passed");
    });
  });
});
