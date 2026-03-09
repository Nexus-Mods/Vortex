const GAME_ID = 'residentevil22019';

function main(context) {
  context.registerGameStub({
    id: GAME_ID,
    executable: null,
    mergeMods: false,
    name: 'Resident Evil 2 (2019)',
    queryModPath: () => '.',
    requiredFiles: [],
  }, {
    name: 'Game: Resident Evil 2 (2019)',
    modId: 432,
  });
}

module.exports = {
  default: main
};
