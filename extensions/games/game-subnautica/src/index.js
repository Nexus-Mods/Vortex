function main(context) {
  context.registerGameStub({
    id: 'subnautica',
    executable: null,
    mergeMods: false,
    name: 'Subnautica',
    queryModPath: () => 'QMods',
    requiredFiles: [],
  }, {
    name: 'Game: Subnautica',
    modId: 202,
  });
}

module.exports = {
  default: main
};
