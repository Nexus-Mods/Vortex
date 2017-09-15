function main(context) {
  context.registerGame({
    id: 'xcom2',
    name: 'X-COM 2',
    logo: 'gameart.png',
    mergeMods: false,
    queryModPath: () => 'XComGame/Mods',
    executable: () => 'Binaries/Win64/XCom2.exe',
    requiredFiles: [
      'XComGame',
      'XComGame/CookedPCConsole/3DUIBP.upk',
    ],
    supportedTools: null,
    details: {
      steamAppId: 268500,
    },
  });

  return true;
}

module.exports = {
  default: main,
};
