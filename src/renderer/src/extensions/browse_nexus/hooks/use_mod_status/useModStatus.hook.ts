import { useIsMutating } from "@tanstack/react-query";
import { GameDomain } from "@vortex/shared";

import { useModInstallState } from "@/extensions/browse_nexus/hooks/use_mod_install_state/useModInstallState.hook";
import type { ModInstallState } from "@/extensions/browse_nexus/util/mod_install_state/modInstallState";
import { type ModStatus, modStatus } from "@/extensions/browse_nexus/util/mod_status/modStatus";
import {
  oneClickFileInstallsKey,
  oneClickInstallKey,
} from "@/extensions/browse_nexus/util/one_click_install/oneClickInstall";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";

/** What the user has of a mod, and the status Browse shows for it. */
export interface IModStatusResult {
  /** What the user has of it. */
  installState: ModInstallState;
  /** Its status; none while a 1-click install of it or its file runs, so it doesn't flicker. */
  status: ModStatus | undefined;
}

/** What the user has of a Browse mod in the active game, and the status to show for it. */
export const useModStatus = (mod: ModSummary): IModStatusResult => {
  const installState = useModInstallState({
    domain: GameDomain(mod.game.domain_name),
    modId: Number(mod.game_scoped_id),
  });
  const isOneClicking = useIsMutating({ mutationKey: oneClickInstallKey(mod.id) }) > 0;
  const isCardOneClicking = useIsMutating({ mutationKey: oneClickFileInstallsKey(mod.id) }) > 0;

  return {
    installState,
    status: isOneClicking || isCardOneClicking ? undefined : modStatus(installState),
  };
};
