import { IGame } from '../../types/IGame';

const game: IGame = {
  id: 'xcom2',
  name: 'X-COM 2',
  logo: 'logo.png',
  mergeMods: false,
  queryModPath: () => 'ComGame/Mods',
  iniFilePath: () => '',
  executable: () => 'XCom2.exe',
  requiredFiles: [
    'XComGame',
    'XComGame/CookedPCConsole/3DUIBP.upk',
  ],
  supportedTools: null,
};

export default game;
