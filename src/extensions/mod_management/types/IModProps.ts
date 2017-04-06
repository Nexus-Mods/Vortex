import { IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from './IMod';

export interface IModProps {
  mods: { [modId: string]: IMod };
  modState: { [modId: string]: IProfileMod };
}

export type IModWithState = IMod & IProfileMod;
