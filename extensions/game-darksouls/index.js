const Promise = require('bluebird');
const fs = require('fs-extra-promise');
const opn = require('opn');
const path = require('path');
const thunk = require('redux-thunk');
const { actions, log, util } = require('vortex-api');

class DarkSouls {
  constructor(context) {
    this.context = context;
    this.id = 'darksouls';
    this.name = 'Dark Souls';
    this.mergeMods = false;
    this.logo = 'gameart.png';
    this.details = {
      steamAppId: 211420,
    };
    this.requiredFiles = ['DATA/DARKSOULS.exe'];
  }

  queryPath() {
    let steam = new util.Steam();
    return steam.allGames()
        .then((games) => {
          console.log('all games', games);
          let game = games.find((entry) => entry.appid === '211420');
          console.log('game', game);
          return (game !== undefined) ? game.gamePath : null;
        })
        .catch((err) => {
          log('debug', 'no steam installed?', { err: err.message });
          return null;
        });
  }

  queryModPath() {
    return path.join('DATA', 'dsfix');
  }

  executable() {
    return path.join('DATA', 'DARKSOULS.exe');
  }

  setup(discovery) {
    console.log('setup', discovery, path.join(discovery.path, this.queryModPath(discovery.path)));
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
                    opn('https://www.nexusmods.com/darksouls/mods/19');
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
