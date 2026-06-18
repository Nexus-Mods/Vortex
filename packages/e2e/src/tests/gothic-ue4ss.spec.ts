/**
 * Install UE4SS from Nexus and verify Gothic 1 Remake deploys the injector files.
 */
import { test } from "../fixtures/vortex-app";
import {
  deployAndExpectFiles,
  installModManagerDownload,
  type GameModScenario,
} from "../helpers/modManagerDownload";
import { Timeouts } from "../helpers/timeouts";
import { freeUser } from "../helpers/users";

const UE4SS_SCENARIO = {
  dynamicGameExtensionId: "gothic1remake",
  expectedDeployedFiles: [
    "G1R/Binaries/Win64/dwmapi.dll",
    "G1R/Binaries/Win64/UE4SS.dll",
    "G1R/Binaries/Win64/UE4SS-settings.ini",
  ],
  expectedModRow: /UE4SS-3/i,
  expectedUrl: /gothic1remake\/mods\/3/,
  gameId: "gothic1remake",
  modUrl: "https://www.nexusmods.com/gothic1remake/mods/3?tab=files",
} as const satisfies GameModScenario;

test.describe("Gothic 1 Remake - UE4SS", () => {
  test.use({
    nexusUser: freeUser,
    dynamicGameExtensionId: UE4SS_SCENARIO.dynamicGameExtensionId,
    managedGameId: UE4SS_SCENARIO.gameId,
  });

  test("installs UE4SS from Nexus and deploys injector files", async ({
    vortexApp,
    vortexWindow,
    managedGame,
    nexusPage,
  }) => {
    await test.step("Install UE4SS from Nexus via Mod Manager Download", async () => {
      await installModManagerDownload({
        expectedModRow: UE4SS_SCENARIO.expectedModRow,
        expectedUrl: UE4SS_SCENARIO.expectedUrl,
        missingNxmMessage: "No nxm:// URL appeared in the page after the UE4SS download click",
        modUrl: UE4SS_SCENARIO.modUrl,
        nexusPage,
        timeoutMs: Timeouts.NETWORK,
        vortexApp,
        vortexWindow,
      });
    });

    await test.step("Deploy UE4SS and verify Gothic Win64 files", async () => {
      await deployAndExpectFiles(
        vortexWindow,
        managedGame.gamePath,
        UE4SS_SCENARIO.expectedDeployedFiles,
        {
          message: "Expected UE4SS files to deploy",
          timeoutMs: Timeouts.NETWORK,
        },
      );
    });
  });
});
