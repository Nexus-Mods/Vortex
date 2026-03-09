function main(context) {
  context.registerGameStub({
    id: 'mountandblade2bannerlord',
    executable: null,
    mergeMods: false,
    name: 'Mount & Blade II:\tBannerlord',
    queryModPath: () => '.',
    requiredFiles: [],
  }, {
    name: "Mount and Blade II Bannerlord Vortex Support",
    modId: 875,
  });
}

module.exports = {
  default: main
};
