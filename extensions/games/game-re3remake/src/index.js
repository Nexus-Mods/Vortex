const GAME_ID = 'residentevil32020';

function main(context) {
  context.registerGameStub({
    id: GAME_ID,
    executable: null,
    mergeMods: false,
    name: 'Resident Evil 3 (2020)',
    queryModPath: () => '.',
    requiredFiles: [],
  }, {
    name: 'Game: Resident Evil 3 (2020)',
    modId: 433,
  });
}

module.exports = {
  default: main
};