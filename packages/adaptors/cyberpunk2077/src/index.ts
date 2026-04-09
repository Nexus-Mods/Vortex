import { provides } from "@vortex/adaptor-api";
import type { IGameInfoService } from "@vortex/adaptor-api/contracts/game-info";
import { gameInfo } from "@vortex/adaptor-api/contracts/game-info";
import type {
  GameFolderMap,
  IGamePathService,
} from "@vortex/adaptor-api/contracts/game-paths";
import { GameFolder } from "@vortex/adaptor-api/contracts/game-paths";
import type { IGameToolsService } from "@vortex/adaptor-api/contracts/game-tools";
import { gameTools } from "@vortex/adaptor-api/contracts/game-tools";
import type { QualifiedPath } from "@vortex/fs";
import { qpath } from "@vortex/fs";

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
export class GamePathService implements IGamePathService {
  resolveGameFolders(
    _store: string,
    installPath: QualifiedPath,
  ): Promise<GameFolderMap> {
    return Promise.resolve({
      [GameFolder.install]: installPath,
      [GameFolder.config]: qpath`${installPath}/engine/config`,
      [GameFolder.preferences]: qpath`${installPath}/engine/config/platform/pc`,
      [GameFolder.saves]: qpath`${installPath}/saved_games`,
    });
  }
}

@provides("vortex:adaptor/cyberpunk2077/tools")
export class GameToolsService implements IGameToolsService {
  getGameTools(folders: GameFolderMap) {
    const install = folders.install;
    if (!install)
      return Promise.reject(new Error("GameFolderMap missing 'install' entry"));
    const result = gameTools({
      game: qpath`${install}/bin/x64/Cyberpunk2077.exe`,
      tools: {
        redmod: {
          executable: qpath`${install}/tools/redmod/bin/redMod.exe`,
          name: "REDmod",
        },
      },
    });

    return Promise.resolve(result);
  }
}
