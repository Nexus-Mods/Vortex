import type { IDownload } from "../../download_management/types/IDownload";
import type { IProfileMod } from "../../profile_management/types/IProfile";

import type { IMod } from "./IMod";

export interface IModProps {
  mods: { [modId: string]: IMod };
  modState: { [modId: string]: IProfileMod };
  downloads: { [downloadId: string]: IDownload };
}

export type IModWithState = IMod & IProfileMod;
