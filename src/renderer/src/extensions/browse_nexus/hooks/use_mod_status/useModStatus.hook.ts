import { useIsMutating } from "@tanstack/react-query";
import { GameDomain } from "@vortex/shared";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";

import { type ModStatus, modStatus } from "../../util/mod_status/modStatus";
import { oneClickInstallKey } from "../../util/one_click_install/oneClickInstall";
import {
  type ModInstallState,
  useModInstallState,
} from "../use_mod_install_state/useModInstallState.hook";

/** What the user has of a mod, and the status Browse shows for it. */
export interface IModStatusResult {
  /** What the user has of it. */
  installState: ModInstallState;
  /** Its status; none while a 1-click install of it runs, so it doesn't flick through its steps. */
  status: ModStatus | undefined;
}

/** What the user has of a Browse mod in the active game, and the status to show for it. */
export const useModStatus = (mod: ModSummary): IModStatusResult => {
  const installState = useModInstallState({
    domain: GameDomain(mod.game.domain_name),
    modId: Number(mod.game_scoped_id),
  });
  const isOneClicking = useIsMutating({ mutationKey: oneClickInstallKey(mod.id) }) > 0;

  return { installState, status: isOneClicking ? undefined : modStatus(installState) };
};
