function main(context) {
  context.registerGameStub({
    id: 'starfield',
    executable: null,
    mergeMods: false,
    name: 'Starfield',
    queryModPath: () => '.',
    requiredFiles: [],
  }, {
    name: 'Game: Starfield',
    modId: 634,
  });
}

module.exports = {
  default: main
};
