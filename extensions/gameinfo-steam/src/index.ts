import Promise from "bluebird";
import { log, types, util } from "vortex-api";

export class NotFound extends Error {
  constructor() {
    super("not found");
    this.name = this.constructor.name;
  }
}

function safeGetTimestamp(input: Date): number {
  if (input === null) {
    return null;
  }
  return input.getTime();
}

type IGameCombo = types.IGameStored & types.IDiscoveryResult;

function findLocalInfo(
  game: IGameCombo,
): Promise<{ appid: string; lastUpdated: Date }> {
  let normalize: (input: string) => string;

  if (game.path === undefined) {
    if (game.details !== undefined && game.details["steamAppId"]) {
      return Promise.resolve({
        appid: game.details["steamAppId"],
        lastUpdated: null,
      });
    } else {
      return Promise.reject(new NotFound());
    }
  }

  return util
    .getNormalizeFunc(game.path)
    .then((normalizeFunc) => {
      normalize = normalizeFunc;
      return util.steam.allGames();
    })
    .then((entries: types.IGameStoreEntry[]) => {
      const searchPath = normalize(game.path);
      const steamGame = entries.find(
        (entry) => normalize(entry.gamePath) === searchPath,
      );
      if (steamGame === undefined) {
        if (
          game.details !== undefined &&
          game.details["steamAppId"] !== undefined
        ) {
          return Promise.resolve({
            appid: game.details["steamAppId"],
            lastUpdated: null,
          });
        } else {
          return Promise.reject(new NotFound());
        }
      } else {
        return Promise.resolve({
          appid: steamGame.appid,
          lastUpdated:
            steamGame.lastUpdated !== undefined
              ? new Date(steamGame.lastUpdated)
              : null,
        });
      }
    });
}

function queryGameSteam(
  api: types.IExtensionApi,
  game: IGameCombo,
): Promise<{ [key: string]: types.IGameDetail }> {
  let foundSteamGame: { appid: string; lastUpdated: Date };

  // let dataRaw;

  return findLocalInfo(game)
    .then((localInfo) => {
      foundSteamGame = localInfo;
      const url = `https://store.steampowered.com/api/appdetails?appids=${foundSteamGame.appid}`;
      log("debug", "requesting game info from steam store", { url });
      return util.jsonRequest(url);
    })
    .then((dat: string) => {
      dat = dat[foundSteamGame.appid];
      if (dat["success"] !== true) {
        log("warn", "steam store request was unsuccessful", { dat });
        return {};
      }
      dat = dat["data"];
      const ret = {
        release_date: {
          title: "Release Date",
          value: util.getSafe(dat, ["release_date", "date"], null),
          type: "date",
        },
        last_updated: {
          title: "Last Updated",
          value: safeGetTimestamp(foundSteamGame.lastUpdated),
          type: "date",
        },
        website: {
          title: "Website",
          value: util.getSafe(dat, ["website"], null),
          type: "url",
        },
        metacritic_score: {
          title: "Score (Metacritic)",
          value: util.getSafe(dat, ["metacritic", "score"], null),
        },
      };
      return ret;
    })
    .catch((err) => {
      if (!(err instanceof NotFound)) {
        log("warn", "failed to request info from steam", {
          gameId: game.id,
          err: err.message,
        });
      }
      return {};
    });
}

function main(context: types.IExtensionContext) {
  context.registerGameInfoProvider(
    "steam",
    50,
    604800000,
    ["release_date", "last_updated", "website", "metacritic_score"],
    (game) => queryGameSteam(context.api, game),
  );
  return true;
}

export default main;
