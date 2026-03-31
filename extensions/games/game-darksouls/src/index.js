const Promise = require('bluebird');
const path = require('path');
const thunk = require('redux-thunk');
const { actions, fs, util } = require('vortex-api');

const STEAM_DLL = 'steam_api.dll';

class DarkSouls {
  constructor(context) {
    this.context = context;
    this.id = 'darksouls';
    this.name = 'Dark Souls';
    this.mergeMods = true;
    this.logo = 'gameart.jpg';
    this.details = {
      steamAppId: 211420,
    };
    this.environment = {
      SteamAPPId: '211420',
    };
    this.requiredFiles = ['DATA/DARKSOULS.exe'];
  }

  queryPath() {
    return util.steam.findByAppId('211420')
        .then(game => game.gamePath);
  }

  queryModPath() {
    return path.join('DATA', 'dsfix', 'tex_override');
  }

  requiresLauncher(gamePath, store) {

      return store === 'steam' ?  Promise.resolve({ launcher: 'steam' }) : Promise.resolve(undefined);
  }

  executable() {
    return path.join('DATA', 'DARKSOULS.exe');
  }

  setup(discovery) {
    return fs.statAsync(path.join(discovery.path, this.queryModPath(discovery.path)))
        .catch(err => {
          if (err.code !== 'ENOENT') {
            return Promise.reject(err);
          }
          return new Promise((resolve, reject) => {
            this.context.api.store.dispatch(actions.showDialog(
                'question', 'Action required',
                { message: 'Modding Dark Souls requires a tool called DSfix' }, [
                  { label: 'Cancel', action: () => reject(new util.UserCanceled()) },
                  { label: 'Go to DSfix page', action: () => {
                    util.opn('https://www.nexusmods.com/darksouls/mods/19').catch(err => undefined);
                    resolve();
                  } },
                  { label: 'Ignore', action: () => resolve() }
                ]));
          });
        });
  }
}

function main(context) {
  context.registerGame(new DarkSouls(context));

  return true;
}

module.exports = {
  default: main,
};
