function main(context) {
  context.registerGame({
    id: 'xcom2',
    name: 'X-COM 2',
    logo: 'gameart.png',
    mergeMods: false,
    queryModPath: () => 'ComGame/Mods',
    executable: () => 'Binaries/Win64/XCom2.exe',
    requiredFiles: [
      'XComGame',
      'XComGame/CookedPCConsole/3DUIBP.upk',
    ],
    supportedTools: null,
  });

  return true;
}

module.exports = {
  default: main,
};
