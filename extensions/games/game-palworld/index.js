function main(context) {
  context.registerGameStub({
    id: 'palworld',
    executable: null,
    mergeMods: false,
    name: 'Palworld',
    queryModPath: () => '.',
    requiredFiles: [],
  }, {
    name: 'Game: Palworld',
    modId: 770,
  });
}

module.exports = {
  default: main
};
