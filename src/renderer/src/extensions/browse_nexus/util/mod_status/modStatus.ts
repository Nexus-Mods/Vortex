import type { ModStatus } from "@/extensions/mod_management/util/mod_status/modStatus";

import type { ModInstallState } from "../mod_install_state/modInstallState";

/** The status to show for what the user has of a mod: none while it's installing, or not had. */
export const modStatus = (state: ModInstallState): ModStatus | undefined => {
  if (state.kind === "installed") {
    return state.update ? "update" : "installed";
  }

  if (state.kind === "downloaded") {
    return "downloaded";
  }

  return undefined;
};
