const GAME_ID = 'devilmaycry5';

function main(context) {
  context.registerGameStub({
    id: GAME_ID,
    executable: null,
    mergeMods: false,
    name: 'Devil May Cry 5',
    queryModPath: () => '.',
    requiredFiles: [],
  }, {
    name: 'Game: Devil May Cry 5',
    modId: 434,
  });
}

module.exports = {
  default: main
};