import * as Promise from 'bluebird';
import { log, types, util } from 'nmm-api';
import * as Redux from 'redux';
import * as request from 'request';

const steam = new util.Steam();

export class NotFound extends Error {
  constructor() {
    super('not found');
    this.name = this.constructor.name;
  }
}

function sendRequest(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    request(url, {}, (err: any, response: request.RequestResponse, body: any) => {
      if (err !== null) {
        return reject(err);
      }
      return resolve(body);
    });
  });
}

function safeGetTimestamp(input: Date): number {
  if (input === null) {
    return null;
  }
  return input.getTime();
}

type IGameCombo = types.IGameStored & types.IDiscoveryResult;

function findLocalInfo(
    game: IGameCombo): Promise<{appid: string, lastUpdated: Date}> {
  let normalize: (input: string) => string;

  if (game.path === undefined) {
    if (game.details['steamAppId']) {
      return Promise.resolve({
        appid: game.details['steamAppId'],
        lastUpdated: null,
      });
    } else {
      return Promise.reject(new NotFound());
    }
  }

  return util.getNormalizeFunc(game.path)
      .then(normalizeFunc => {
        normalize = normalizeFunc;
        return steam.allGames();
      })
      .then(entries => {
        const searchPath = normalize(game.path);
        const steamGame =
            entries.find(entry => normalize(entry.gamePath) === searchPath);
        if (steamGame === undefined) {
          if (game.details['steamAppId'] !== undefined) {
            return Promise.resolve({
              appid: game.details['steamAppId'],
              lastUpdated: null,
            });
          } else {
            return Promise.reject(new NotFound());
          }
        }
      });
}

function queryGameSteam(api: types.IExtensionApi, game: IGameCombo):
  Promise<{ [key: string]: types.IGameDetail }> {
    let foundSteamGame: { appid: string, lastUpdated: Date };

    return findLocalInfo(game)
        .then(localInfo => {
          foundSteamGame = localInfo;
          const url =
              `http://store.steampowered.com/api/appdetails?appids=${foundSteamGame.appid}`;
          return sendRequest(url);
        })
        .then(response => {
          let dat = JSON.parse(response)[foundSteamGame.appid];
          if (dat['success'] !== true) {
            return {};
          }
          dat = dat['data'];
          const ret = {
            release_date: {
              title: api.translate('Release Date'),
              value: util.getSafe(dat, ['release_date', 'date'], null),
              type: 'date',
            },
            last_updated: {
              title: api.translate('Last Updated'),
              value: safeGetTimestamp(foundSteamGame.lastUpdated),
              type: 'date',
            },
            website: {
              title: api.translate('Website'),
              value: util.getSafe(dat, ['website'], null),
              type: 'url',
            },
            metacritic_score: {
              title: api.translate('Score (Metacritic)'),
              value: util.getSafe(dat, ['metacritic', 'score'], null),
            },
          };
          return ret;
        })
        .catch(err => {
          if (!(err instanceof NotFound)) {
            log('warn', 'failed to request info from steam',
                {gameId: game.id, err: err.message});
          }
          return {};
        });
}

function main(context: types.IExtensionContext) {
  context.registerGameInfoProvider(
    'steam', 50, 604800000,
    ['release_date', 'last_updated', 'website', 'metacritic_score'],
    game => queryGameSteam(context.api, game));
  return true;
}

export default main;
