import type { ICollectionRevisionMod } from "@nexusmods/nexus-api";

import type { IMod, IModRule } from "../../../extensions/mod_management/types/IMod";
import type { IProfileMod } from "../../../extensions/profile_management/types/IProfile";

export type IModEx = IMod &
  IProfileMod & {
    collectionRule: IModRule;
    progress?: number;
    infoFromApi?: ICollectionRevisionMod;
  };
