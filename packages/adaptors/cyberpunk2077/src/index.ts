import { provides } from "@vortex/adaptor-api";
import type { IGameInfoService } from "@vortex/adaptor-api/contracts/game-info";
import { gameInfo } from "@vortex/adaptor-api/contracts/game-info";
import type {
  GamePaths,
  IGamePathService,
} from "@vortex/adaptor-api/contracts/game-paths";
import { rehydrateGamePaths } from "@vortex/adaptor-api/contracts/game-paths";
import type { IGameToolsService } from "@vortex/adaptor-api/contracts/game-tools";
import { gameTools } from "@vortex/adaptor-api/contracts/game-tools";
import type {
  StorePathProvider,
  StorePathSnapshot,
} from "@vortex/adaptor-api/stores/lib";
import {
  Base,
  OS,
  createStorePathProvider,
} from "@vortex/adaptor-api/stores/lib";
import type { QualifiedPath } from "@vortex/fs";

type CyberpunkExtras = "saves" | "preferences";
type CyberpunkPaths = GamePaths<CyberpunkExtras>;

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
  async paths(snapshot: StorePathSnapshot): Promise<CyberpunkPaths> {
    const provider: StorePathProvider = createStorePathProvider(snapshot);
    const game = await provider.fromBase(Base.Game);

    let saves: QualifiedPath;
    let preferences: QualifiedPath;
    if (provider.gameOS === OS.Windows) {
      const home = await provider.fromBase(Base.Home);
      const appData = await provider.fromBase(Base.AppData);
      saves = home.join("Saved Games", "CD Projekt Red", "Cyberpunk 2077");
      preferences = appData.join("Local", "CD Projekt Red", "Cyberpunk 2077");
    } else {
      // Native Linux builds keep saves/config inside the install directory.
      saves = game.join("saved_games");
      preferences = game.join("engine", "config", "platform", "pc");
    }

    return new Map<Base | CyberpunkExtras, QualifiedPath>([
      [Base.Game, game],
      ["saves", saves],
      ["preferences", preferences],
    ]);
  }
}

@provides("vortex:adaptor/cyberpunk2077/tools")
export class GameToolsService implements IGameToolsService<CyberpunkExtras> {
  getGameTools(paths: CyberpunkPaths) {
    const rehydrated = rehydrateGamePaths<CyberpunkExtras>(paths);
    const game = rehydrated.get(Base.Game);
    if (!game) {
      return Promise.reject(new Error("GamePaths missing 'game' entry"));
    }
    const result = gameTools({
      game: game.join("bin", "x64", "Cyberpunk2077.exe"),
      tools: {
        redmod: {
          executable: game.join("tools", "redmod", "bin", "redMod.exe"),
          name: "REDmod",
        },
      },
    });

    return Promise.resolve(result);
  }
}
