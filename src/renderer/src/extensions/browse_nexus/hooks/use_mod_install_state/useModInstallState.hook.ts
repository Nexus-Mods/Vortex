import { VortexGameId } from "@vortex/shared";
import { shallowEqual, useSelector } from "react-redux";

import type { IMod } from "@/extensions/mod_management/types/IMod";
import { activeProfile } from "@/extensions/profile_management/selectors";
import type { IProfileMod } from "@/extensions/profile_management/types/IProfile";
import type { IState } from "@/types/IState";
import { activeGameId } from "@/util/selectors";

import { groupedModInstallState } from "../../util/mod_install_state/modInstallGroups";
import type { INexusModRef, ModInstallState } from "../../util/mod_install_state/modInstallState";
import { gameDomains, modInstallGroups } from "./modInstallSelectors";

const NO_MODS: { [modId: string]: IMod } = {};

const NO_MOD_STATE: { [modId: string]: IProfileMod } = {};

const NONE: ModInstallState = { kind: "none" };

/**
 * What the user has of a mod in the active game; see `modInstallState`. Looks through only the
 * mod's own group, and compares field by field, so a download's progress doesn't re-render.
 */
export const useModInstallState = (ref: INexusModRef): ModInstallState =>
  useSelector((state: IState): ModInstallState => {
    const groups = modInstallGroups(state);
    const active = activeGameId(state);

    if (!groups || !active) {
      return NONE;
    }

    const gameId = VortexGameId(active);

    return groupedModInstallState(
      groups,
      {
        mods: state.persistent.mods[gameId] ?? NO_MODS,
        modState: activeProfile(state)?.modState ?? NO_MOD_STATE,
        downloads: state.persistent.downloads.files,
        gameId,
        domainOf: gameDomains(state),
      },
      ref,
    );
  }, shallowEqual);
