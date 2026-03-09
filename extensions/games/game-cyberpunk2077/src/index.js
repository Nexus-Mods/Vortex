function main(context) {
  context.registerGameStub({
    id: 'cyberpunk2077',
    executable: null,
    mergeMods: false,
    name: 'Cyberpunk 2077',
    queryModPath: () => '.',
    requiredFiles: [],
  }, {
    name: 'Game: Cyberpunk 2077',
    modId: 196,
  });
}

module.exports = {
  default: main
};
