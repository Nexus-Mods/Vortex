const path = require('path');
const { log, util } = require('vortex-api');

function main(context) {
  context.registerGame({
    id: 'stateofdecay',
    name: 'State of Decay',
    mergeMods: true,
    queryArgs: {
      steam: [
        { name: 'State of Decay: Year-One', prefer: 0 },
        { name: 'State of Decay' },
      ],
    },
    queryModPath: () => 'game',
    logo: 'gameart.jpg',
    executable: () => 'StateOfDecay.exe',
    requiredFiles: [
      'StateOfDecay.exe',
    ],
    environment: {
      SteamAPPId: '241540',
    },
    details: {
      steamAppId: 241540,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
