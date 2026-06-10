import type { ICollectionRevisionMod } from "@nexusmods/nexus-api";

import type * as types from "../../../types/api";

export type IModEx = types.IMod &
  types.IProfileMod & {
    collectionRule: types.IModRule;
    progress?: number;
    infoFromApi?: ICollectionRevisionMod;
  };
