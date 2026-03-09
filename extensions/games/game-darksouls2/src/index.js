const path = require('path');
const { log, util } = require('vortex-api');

const EXEC_PATH = path.join('Game', 'DarksoulsII.exe');

class DarkSouls2 {
  constructor(context) {
    this.context = context;
    this.id = 'darksouls2';
    this.name = 'Dark Souls II';
    this.mergeMods = true;
    this.logo = 'gameart.jpg';
    this.environment = {
      SteamAPPId: '236430',
    };
    this.details = {
      steamAppId: 236430,
    };
    this.requiredFiles = [EXEC_PATH];
  }

  queryPath() {
    return util.steam.findByAppId(['236430', '335300'])
      .then(game => {
        if (game.appid === '335300') {
          this.details = {
            steamAppId: game.appid,
          };
        }
        return game.gamePath;
      });
  }

  queryModPath() {
    return '.';
  }

  executable() {
    return EXEC_PATH;
  }
}

function main(context) {
  context.registerGame(new DarkSouls2(context));

  return true;
}

module.exports = {
  default: main,
};
