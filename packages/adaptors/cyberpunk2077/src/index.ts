import { provides } from "@vortex/adaptor-api";
import type { IGameInfoService } from "@vortex/adaptor-api/contracts/game-info";
import { gameInfo } from "@vortex/adaptor-api/contracts/game-info";
import type {
  IGameInstallerService,
  InstallMapping,
  StopPattern,
} from "@vortex/adaptor-api/contracts/game-installer";
import { resolveStopPatterns } from "@vortex/adaptor-api/contracts/game-installer";
import type {
  GamePaths,
  IGamePathService,
} from "@vortex/adaptor-api/contracts/game-paths";
import { rehydrateGamePaths } from "@vortex/adaptor-api/contracts/game-paths";
import type { IGameToolsService } from "@vortex/adaptor-api/contracts/game-tools";
import { gameTools } from "@vortex/adaptor-api/contracts/game-tools";
import type { StorePathProvider } from "@vortex/adaptor-api/stores/lib";
import { Base } from "@vortex/adaptor-api/stores/lib";
import type { RelativePath } from "@vortex/fs";

type CyberpunkExtras = "saves" | "preferences";
type CyberpunkPaths = GamePaths<"game" | CyberpunkExtras>;

const INFO = gameInfo({
  gameUri: "game:cyberpunk2077",
  displayName: "Cyberpunk 2077",
  steam: 1091500,
  epic: "77f2b98e2cef40c8a7437518bf420e47",
  gog: 1423049311,
  nexusMods: "cyberpunk2077",
});

@provides("vortex:adaptor/cyberpunk2077/info")
export class GameInfoService implements IGameInfoService {
  getGameInfo() {
    return Promise.resolve(INFO);
  }
}

@provides("vortex:adaptor/cyberpunk2077/paths")
export class GamePathService implements IGamePathService<CyberpunkExtras> {
  async paths(provider: StorePathProvider): Promise<CyberpunkPaths> {
    // Cyberpunk 2077 has no native Linux build. On Linux hosts, the
    // only supported configuration is Proton, in which case gameOS is
    // Windows (the game thinks it's on Windows inside the Wine prefix).
    // A gameOS of Linux means the caller handed us a native Linux
    // discovery, which cannot exist for this title.
    if (!provider.isWindows) {
      throw new Error(
        "Cyberpunk 2077 has no native Linux build; gameOS must be Windows (Proton)",
      );
    }

    const game = await provider.fromBase(Base.Game);
    const home = await provider.fromBase(Base.Home);
    const appData = await provider.fromBase(Base.AppData);
    const saves = home.join("Saved Games", "CD Projekt Red", "Cyberpunk 2077");
    const preferences = appData.join(
      "Local",
      "CD Projekt Red",
      "Cyberpunk 2077",
    );

    return { game, saves, preferences };
  }
}

@provides("vortex:adaptor/cyberpunk2077/tools")
export class GameToolsService implements IGameToolsService<CyberpunkExtras> {
  getGameTools(paths: CyberpunkPaths) {
    const rehydrated = rehydrateGamePaths(paths);
    const result = gameTools({
      game: rehydrated.game.join("bin", "x64", "Cyberpunk2077.exe"),
      tools: {
        redmod: {
          executable: rehydrated.game.join(
            "tools",
            "redmod",
            "bin",
            "redMod.exe",
          ),
          name: "REDmod",
        },
      },
    });

    return Promise.resolve(result);
  }
}

/**
 * Stop-pattern set for Cyberpunk 2077 mod installation. Patterns are
 * tried in order; the first match wins. Every Cyberpunk mod installs
 * under the game install directory, so all anchors are Base.Game.
 *
 * Translated from the canonical paths documented in the community
 * redux extension (E1337Kat/cyberpunk2077_ext_redux, installers.layouts.ts).
 * Not all bespoke detection paths translate; patterns here cover the
 * common-case canonical layouts only.
 */
const CYBERPUNK_STOP_PATTERNS: readonly StopPattern<CyberpunkExtras>[] = [
  // Loose archive/.xl files at the archive root, remapped into the
  // canonical mod directory.
  {
    match: "*.{archive,xl}",
    anchor: Base.Game,
    destination: "archive/pc/mod/{basename}",
  },

  // Canonical and legacy-patch archive mods.
  { match: "**/archive/pc/{mod,patch}/**/*.{archive,xl}", anchor: Base.Game },

  // CET (Cyber Engine Tweaks) mods.
  {
    match: "**/bin/x64/plugins/cyber_engine_tweaks/mods/**",
    anchor: Base.Game,
  },
  { match: "**/bin/x64/plugins/cyber_engine_tweaks/**", anchor: Base.Game },

  // ReShade (installed into bin/x64).
  { match: "**/bin/x64/reshade-shaders/**", anchor: Base.Game },
  { match: "**/bin/x64/*.ini", anchor: Base.Game },

  // Red4Ext native plugins.
  { match: "**/red4ext/plugins/**", anchor: Base.Game },

  // REDscript sources and their config.
  { match: "**/r6/scripts/**/*.{reds,toml}", anchor: Base.Game },

  // TweakXL tweak data.
  { match: "**/r6/tweaks/**/*.{yaml,yml}", anchor: Base.Game },

  // Audioware audio mods.
  {
    match: "**/r6/audioware/**/*.{yaml,yml,wav,ogg,mp3,flac}",
    anchor: Base.Game,
  },

  // User configs (XML and JSON).
  { match: "**/r6/config/**/*.{xml,json}", anchor: Base.Game },

  // REDmod packages (self-contained mod directories under mods/).
  { match: "**/mods/**", anchor: Base.Game },

  // Engine config and tool files.
  { match: "**/engine/config/**/*.{ini,json,xml}", anchor: Base.Game },
  { match: "**/engine/tools/**", anchor: Base.Game },
];

@provides("vortex:adaptor/cyberpunk2077/installer")
export class GameInstallerService implements IGameInstallerService<CyberpunkExtras> {
  install(
    _context: StorePathProvider,
    _paths: CyberpunkPaths,
    files: readonly RelativePath[],
  ): Promise<readonly InstallMapping<CyberpunkExtras>[]> {
    return Promise.resolve(resolveStopPatterns(CYBERPUNK_STOP_PATTERNS, files));
  }
}
