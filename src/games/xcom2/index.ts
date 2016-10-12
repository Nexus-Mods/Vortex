import { IGame } from '../../types/IGame';

const game: IGame = {
  id: 'xcom2',
  name: 'X-COM 2',
  logo: 'logo.png',
  mergeMods: false,
  queryModPath: () => 'ComGame/Mods',
  requiredFiles: [
    'XComGame',
    'XComGame/CookedPCConsole/3DUIBP.upk',
  ],
  supportedTools: null,
};

export default game;
