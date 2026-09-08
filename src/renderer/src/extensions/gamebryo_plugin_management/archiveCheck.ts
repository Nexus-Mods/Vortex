import * as path from "path";

import { log } from "../../logging";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { ITestResult, ProblemSeverity } from "../../types/ITestResult";
import * as fs from "../../util/fs";
import { getSafe } from "../../util/storeHelper";
import { discoveryByGame } from "../gamemode_management/selectors";
import { modsForGame } from "../mod_management/selectors";
import { activeGameId } from "../profile_management/selectors";
import type { IDataArchive, IGameData, IIncompatibleArchive } from "./types/IArchiveCheck";
import type { IPluginCombined } from "./types/IPlugins";
import type { IStateWithGamebryo } from "./types/IStateWithGamebryo";

const archiveData: IGameData[] = [
  {
    gameId: "skyrim",
    gameName: "Skyrim (2011)",
    version: [104, 103],
    type: "BSA",
  },
  {
    gameId: "skyrimse",
    gameName: "Skyrim Special Edition",
    version: [105],
    type: "BSA",
  },
  {
    gameId: "skyrimvr",
    gameName: "Skyrim VR",
    version: [105],
    type: "BSA",
  },
  {
    gameId: "oblivion",
    gameName: "Oblivion",
    version: [103],
    type: "BSA",
  },
  {
    gameId: "fallout3",
    gameName: "Fallout 3",
    version: [104],
    type: "BSA",
  },
  {
    gameId: "newvegas",
    gameName: "Fallout New Vegas",
    version: [104],
    type: "BSA",
  },
  {
    gameId: "fallout4",
    gameName: "Fallout 4",
    version: [8, 7, 1],
    type: "BA2",
  },
  {
    gameId: "fallout4vr",
    gameName: "Fallout 4 VR",
    version: [1],
    type: "BA2",
  },
  {
    gameId: "fallout76",
    gameName: "Fallout 76",
    version: [1],
    type: "BA2",
  },
  {
    gameId: "starfield",
    gameName: "Starfield",
    version: [3, 2, 1],
    type: "BA2",
  },
];

/** health test of the folded gamebryo-archive-check extension */
export async function testIncompatibleArchives(api: IExtensionApi): Promise<ITestResult> {
  const plugInfo = api.getState<IStateWithGamebryo>().session.plugins?.pluginInfo ?? {};
  return checkForErrors(api, plugInfo);
}

async function checkForErrors(
  api: IExtensionApi,
  pluginsObj: { [id: string]: IPluginCombined },
): Promise<ITestResult> {
  // Check this is a game we want to run this check on.
  const state = api.getState<IStateWithGamebryo>();
  const gameId = activeGameId(state);
  const gameData: IGameData = archiveData.find((g) => g.gameId === gameId);
  if (!gameData) {
    return undefined;
  }

  // Get the plugins for the current game.
  if (!pluginsObj || !Object.keys(pluginsObj)) {
    return undefined;
  }

  const plugins = Object.keys(pluginsObj)
    .map((k) => pluginsObj[k])
    .sort((a, b) => (a.loadOrder > b.loadOrder ? 1 : -1));

  // We want only enabled plugins that load archives, but aren't base game files.
  const archiveLoaders = plugins.filter(
    (p) => !p.isNative && p.loadsArchive && getSafe(state, ["loadOrder", p.id, "enabled"], false),
  );

  // Get the list of mods and the data folder path.
  const mods = modsForGame(state, gameId);
  const discoveryPath = discoveryByGame(state, gameId)?.path;

  const dataFolder = discoveryPath ? path.join(discoveryPath, "Data") : undefined;

  const normalize = (fileName: string) => {
    const noExt = path.basename(fileName, path.extname(fileName)).toLowerCase();
    return noExt.normalize("NFC");
  };

  const checkNotifId = "checking-archives-all";
  try {
    const dataFiles = await fs.readdirAsync(dataFolder);
    const dataArchives = dataFiles.filter((f) => [".ba2", ".bsa"].includes(path.extname(f)));
    const archivesToCheck: IDataArchive[] = archiveLoaders.reduce((accum, plugin) => {
      const arcs: IDataArchive[] = dataArchives
        .filter((a) => normalize(a).startsWith(normalize(plugin.name)))
        .map((a) => ({ name: a, plugin: plugin.name }));

      accum = accum.concat(arcs);
      return accum;
    }, []);

    // If there's nothing to check, we can exit here.
    if (!archivesToCheck.length) {
      return undefined;
    }

    let pos = 0;

    // Updatable notification.
    const progress = (archiveName: string) => {
      api.sendNotification({
        id: checkNotifId,
        progress: (pos * 100) / archivesToCheck.length,
        title: "Checking archives",
        message: archiveName,
        type: "activity",
      });
      ++pos;
    };

    const issues: IIncompatibleArchive[] = await archivesToCheck.reduce(async (accumP, archive) => {
      const accum = await accumP;
      progress(archive.name);
      try {
        const version = await streamArchiveVersion(path.join(dataFolder, archive.name));
        if (gameData.version.includes(version)) {
          return accum;
        }

        const plugin = plugins.find((p) => p.name === archive.plugin);
        const mod = plugin ? mods[plugin.modId] : undefined;
        accum.push({
          name: archive.name,
          version,
          validVersion: gameData.version.join("/"),
          plugin,
          mod,
        });
        return accum;
      } catch (err) {
        log("error", "Error checking archive versions", err);
        return accum;
      }
    }, Promise.resolve([]));

    api.dismissNotification(checkNotifId);

    return issues?.length > 0 ? genTestResult(api, issues, gameData) : undefined;
  } catch (err) {
    api.dismissNotification(checkNotifId);
    api.showErrorNotification("Error checking for archive errors", err);
    return undefined;
  }
}

function genTestResult(
  api: IExtensionApi,
  issues: IIncompatibleArchive[],
  gameData: IGameData,
): ITestResult {
  const t = api.translate;
  const thisGame = gameData.gameName;
  const groupedErrors = issues.reduce(
    (accum, cur) => {
      if (cur.mod) {
        accum[cur.mod.id] = [].concat(accum[cur.mod.id] || [], cur);
      } else {
        accum.noMod.push(cur);
      }
      return accum;
    },
    { noMod: [] },
  );

  const errorsByMod = Object.keys(groupedErrors).map((key) => {
    const group = groupedErrors[key];
    const mod = key !== "noMod" ? group[0].mod : { id: "", attributes: {} };
    const attr = mod.attributes;
    const modName = attr.customName || attr.logicalFileName || attr.name || mod.id;

    if (!group.length) {
      return "";
    }
    const archiveErrors = group.map((a) => {
      const games =
        archiveData
          .filter((g) => g.version.includes(a.version[0]))
          .map((g) => g.gameName)
          .join("/") || t("an unknown game");

      const plugin = a.plugin.name;
      const errMsg = t("Is loaded by {{plugin}}, but is intended for use in {{games}}.", {
        replace: { plugin, games },
      });
      return `[*][b]${a.name}[/b] - ${errMsg}`;
    });

    const groupInfo = modName ? modName : t("not managed by Vortex");

    return (
      `[h5]${t("Incompatible Archives")} ${groupInfo}:[/h5]` +
      `[list]${archiveErrors.join("\n")}[/list]<br/><br/>`
    );
  });

  return {
    description: {
      short: "Incompatible mod archive(s)",
      long:
        t(
          "Some of the archives in your load order are incompatible with {{thisGame}}. " +
            "Using incompatible archives may cause your game to crash on load.",
          { replace: { thisGame } },
        ) +
        `${errorsByMod.join()}` +
        t(
          "You can fix this problem yourself by removing any mods that are not intended to be used with {{thisGame}}. " +
            "If you downloaded these mods from the correct game site at Nexus Mods, you should inform the mod author of this issue. " +
            "Archives for this game must be {{ext}} files (v{{ver}}).",
          {
            replace: {
              thisGame,
              ext: gameData.type,
              ver: gameData.version.join("/"),
            },
          },
        ),
    },
    severity: "error" as ProblemSeverity,
  };
}

async function streamArchiveVersion(filePath: string): Promise<any> {
  // Open a stream to the first 9 bytes of the file.
  const stream = fs.createReadStream(filePath, { start: 0, end: 8 });

  return (
    new Promise((resolve) => {
      // Create a buffer to house those bytes.
      const data = Buffer.alloc(9);
      stream.on("data", (chunk) => {
        // Fill the buffer.
        data.fill(chunk);
        // Resolve to the archive version number.
        const versionBytes = data.slice(4, 8);
        const version = versionBytes.reduce((accum, entry) => accum + entry, 0);
        resolve(version);
      });

      stream.on("error", () => resolve(0));
    })
      // Destroy the file stream.
      .finally(() => stream.destroy())
  );
}
