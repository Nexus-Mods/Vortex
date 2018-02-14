const { log, util } = require('vortex-api');

class DarkSouls2 {
  constructor(context) {
    this.context = context;
    this.id = 'darksouls2';
    this.name = 'Dark Souls II';
    this.mergeMods = false;
    this.logo = 'gameart.png';
    this.details = {
      steamAppId: 236430,
    };
    this.requiredFiles = ['DarksoulsII.exe'];
  }

  queryPath() {
    return util.steam.findByAppId(['236430', '335300'])
        .then(game => {
          if (game.appid === '335300') {
            this.details.steamAppId = game.appid;
          }
          return game.gamePath;
        });
  }

  queryModPath() {
    return '.';
  }

  executable() {
    return 'DarksoulsII.exe';
  }

}

function main(context) {
  context.registerGame(new DarkSouls2(context));

  return true;
}

module.exports = {
  default: main,
};
