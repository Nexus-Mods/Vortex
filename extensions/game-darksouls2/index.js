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
    let steam = new util.Steam();
    return steam.allGames()
        .then((games) => {
          let game = games.find((entry) => ['236430', '335300'].indexOf(entry.appid) !== -1);
          if ((game !== undefined) && (game.appid === '335300')) {
            this.details.steamAppId = game.appid;
          }

          return (game !== undefined) ? game.gamePath : null;
        })
        .catch((err) => {
          log('debug', 'no steam installed?', { err: err.message });
          return null;
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
