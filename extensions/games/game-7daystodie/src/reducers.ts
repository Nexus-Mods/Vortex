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

const settingsActions = { setPrefixOffset, setUDF, setPreviousLO };

export const reducer = util.actionsToReducerSpec<I7DTDSettings, typeof settingsActions>(
  {},
  settingsActions,
  {
    setPrefixOffset: (state, payload) => {
      const { profile, offset } = payload;
      return util.setSafe(state, ["prefixOffset", profile], offset);
    },
    setUDF: (state, payload) => {
      const { udf } = payload;
      return util.setSafe(state, ["udf"], udf);
    },
    setPreviousLO: (state, payload) => {
      const { profile, previousLO } = payload;
      return util.setSafe(state, ["previousLO", profile], previousLO);
    },
  },
);
