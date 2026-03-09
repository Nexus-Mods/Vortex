import { util } from 'vortex-api';
import path from 'path';

export const MOD_INFO = 'modinfo.xml';
export const GAME_ID = '7daystodie';
export const LO_FILE_NAME = 'loadOrder.json';
export const I18N_NAMESPACE = `game-${GAME_ID}`;
export const INVALID_LO_MOD_TYPES = ['collection', '7dtd-root-mod'];

export function launcherSettingsFilePath(): string {
  return path.join(util.getVortexPath('appData'), '7DaysToDie', 'launchersettings.json');
}

export function loadOrderFilePath(profileId: string): string {
  return path.join(util.getVortexPath('appData'), '7DaysToDie', profileId + '_' + LO_FILE_NAME);
}

export function modsRelPath() {
  return 'Mods';
}

export function gameExecutable() {
  return '7DaysToDie.exe';
}

export const DEFAULT_LAUNCHER_SETTINGS = {
  ShowLauncher : false,
  DefaultRunConfig : {
    ExclusiveMode : false,
    Renderer : "dx11",
    UseGamesparks : true,
    UseEAC : true,
    UseNativeInput : false,
    AdditionalParameters : ""
  }
}