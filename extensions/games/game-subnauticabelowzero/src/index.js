function main(context) {
  context.registerGameStub({
    id: 'subnauticabelowzero',
    executable: null,
    mergeMods: false,
    name: 'Subnautica: Below Zero',
    queryModPath: () => 'QMods',
    requiredFiles: [],
  }, {
    name: 'Game: Subnautica: Below Zero',
    modId: 203,
  });
}

module.exports = {
  default: main
};
