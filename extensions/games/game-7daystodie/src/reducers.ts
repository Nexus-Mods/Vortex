import { types, util } from "@nexusmods/vortex-api";

import { setPrefixOffset, setPreviousLO, setUDF } from "./actions";
import type { LoadOrder } from "./types";

/** `settings.7daystodie`; every field starts out unset */
export interface I7DTDSettings {
  /** load order prefix offset, per profile */
  prefixOffset?: { [profileId: string]: number };
  /** the user data folder */
  udf?: string;
  /** the load order before the last change, per profile */
  previousLO?: { [profileId: string]: LoadOrder };
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISettings {
      "7daystodie": I7DTDSettings;
    }
  }
}

export const reducer: types.IReducerSpec<I7DTDSettings> = {
  reducers: {
    [setPrefixOffset as any]: (
      state: I7DTDSettings,
      payload: { profile: string; offset: number },
    ) => {
      const { profile, offset } = payload;
      return util.setSafe(state, ["prefixOffset", profile], offset);
    },
    [setUDF as any]: (state: I7DTDSettings, payload: { udf: string }) => {
      const { udf } = payload;
      return util.setSafe(state, ["udf"], udf);
    },
    [setPreviousLO as any]: (
      state: I7DTDSettings,
      payload: { profile: string; previousLO: LoadOrder },
    ) => {
      const { profile, previousLO } = payload;
      return util.setSafe(state, ["previousLO", profile], previousLO);
    },
  },
  defaults: {},
};
