import { describe, expect, it } from "vitest";

import {
  collectDependencyDiagnostics,
  detectContentSignals,
} from "./dependencies";

describe("cyberpunk dependency heuristics", () => {
  it("detects install-time content signals from authored files", () => {
    const signals = detectContentSignals([
      "r6\\tweaks\\example.yaml",
      "bin\\x64\\plugins\\cyber_engine_tweaks\\mods\\example\\init.lua",
      "red4ext\\plugins\\Example\\Example.dll",
      "archive\\pc\\mod\\example.xl",
      "scripts\\example.reds",
    ]);

    expect(signals).toEqual({
      hasArchiveXL: true,
      hasCetLua: true,
      hasRed4ExtPlugin: true,
      hasReds: true,
      hasRedmod: true,
      hasTweaks: true,
    });
  });

  it("only emits missing dependency diagnostics for required frameworks", () => {
    const diagnostics = collectDependencyDiagnostics(
      {
        gameId: "cyberpunk2077",
        mods: [
          {
            id: "mod-1",
            name: "Example Mod",
            attributes: {
              V2077_mod_attr_content_signals: {
                data: {
                  hasArchiveXL: true,
                  hasCetLua: false,
                  hasRed4ExtPlugin: false,
                  hasReds: false,
                  hasRedmod: false,
                  hasTweaks: true,
                },
              },
            },
          },
        ],
        loadOrder: [],
      },
      {
        modId: 0,
        modName: "Cyberpunk 2077 Setup",
      },
      "cyberpunk2077",
    );

    expect(diagnostics.map((item) => item.id).sort()).toEqual([
      "cyberpunk-missing-archivexl",
      "cyberpunk-missing-red4ext",
      "cyberpunk-missing-tweakxl",
    ]);
  });
});
