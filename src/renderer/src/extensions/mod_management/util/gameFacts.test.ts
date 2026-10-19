import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { FileSourceKind, resolve, type FileSource } from "@nexusmods/mod-pipeline";
import { expect, vi } from "vitest";

import type * as NexusIntegrationUtil from "../../nexus_integration/util";

// util/Steam reads paths at import time and there is no ApplicationData here
vi.mock("../../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));
// the Nexus game list comes from the network
vi.mock("../../nexus_integration/util", async (importOriginal) => ({
  ...(await importOriginal<typeof NexusIntegrationUtil>()),
  nexusGames: () => [{ domain_name: "skyrimspecialedition", id: 1704 }],
}));

import { makeMod, makeRealDeploymentMethod } from "../../../test-utils/builders";
import { makeDeployedGame } from "../../../test-utils/deployedGame";
import { test } from "../../../test-utils/harnessTest";
import { checksum } from "../../../util/checksum";
import getNormalizeFunc from "../../../util/getNormalizeFunc";
import { getGame } from "../../gamemode_management/util/getGame";
import hardlinkInit from "../../hardlink_activator";
import deployMods from "../modActivation";
import { sessionReducer } from "../reducers/session";
import type { IMod } from "../types/IMod";
import BlacklistSet from "./BlacklistSet";
import { genSubDirFunc } from "./deploy";
import { deployedFilePath } from "./deployedFilePath";
import { gatherGameFacts } from "./gameFacts";
import { doSortMods } from "./sort";

const hashFile = async (filePath: string) => checksum(await readFile(filePath));
const toPortablePath = (filePath: string) => filePath.replaceAll("\\", "/");

test("the resolver deploys each file where today's deployment does, from the same mod", async () => {
  const game = await makeDeployedGame({
    methodId: "hardlink_activator",
    extraReducers: [{ path: ["session", "mods"], reducer: sessionReducer }],
  });
  const mods: Record<string, IMod> = {
    ModA: makeMod({
      id: "ModA",
      installationPath: "ModA",
      attributes: { source: "nexus", fileId: 1001 },
    }),
    ModB: makeMod({
      id: "ModB",
      installationPath: "ModB",
      rules: [{ type: "after", reference: { id: "ModA" } }],
    }),
    ModC: makeMod({
      id: "ModC",
      installationPath: "ModC",
      fileOverrides: [path.join(game.dataPath, "meshes", "rock.nif")],
      rules: [{ type: "after", reference: { id: "ModB" } }],
    }),
  };
  const stagedFiles = {
    ModA: ["ModA.esp", path.join("textures", "sky.dds")],
    ModB: [path.join("textures", "sky.dds"), path.join("meshes", "rock.nif"), "meta.ini"],
    ModC: [path.join("meshes", "rock.nif")],
  };
  for (const [modId, relPaths] of Object.entries(stagedFiles)) {
    for (const relPath of relPaths) {
      const stagedPath = path.join(game.stagingPath, modId, relPath);
      await mkdir(path.dirname(stagedPath), { recursive: true });
      await writeFile(stagedPath, `${modId} ${relPath}`);
    }
  }
  game.setState((draft) => {
    draft.persistent.mods[game.gameId] = mods;
    draft.persistent.profiles[game.profileId].modState = {
      ModA: { enabled: true, enabledTime: 0 },
      ModB: { enabled: true, enabledTime: 0 },
      ModC: { enabled: true, enabledTime: 0 },
    };
    draft.settings.gameMode.discovered[game.gameId].store = "steam";
  });

  const harnessGame = getGame(game.gameId);
  const normalize = await getNormalizeFunc(game.dataPath);
  const deployed = await deployMods(
    game.api,
    game.gameId,
    game.stagingPath,
    game.dataPath,
    await doSortMods(game.api, game.getState().persistent.profiles[game.profileId], mods),
    makeRealDeploymentMethod(game.api, hardlinkInit),
    [],
    "",
    new BlacklistSet([], harnessGame, normalize),
    genSubDirFunc(harnessGame, undefined),
  );
  const deployedFiles = await Promise.all(
    deployed.map(async (file): Promise<FileSource> => {
      const destinationPath = toPortablePath(
        deployedFilePath(game.dataPath, file.target, file.relPath),
      );
      return file.source === "ModA"
        ? { source: FileSourceKind.Nexus, fileId: "1001", destinationPath }
        : {
            source: FileSourceKind.UserGenerated,
            fileHash: await hashFile(path.join(game.stagingPath, file.source, file.relPath)),
            destinationPath,
          };
    }),
  );

  const lockfile = resolve(game.getState(), await gatherGameFacts(game.api, game.gameId, hashFile));

  expect(lockfile.files).toEqual(
    deployedFiles.toSorted((lhs, rhs) => (lhs.destinationPath < rhs.destinationPath ? -1 : 1)),
  );
});
