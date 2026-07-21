import { onDownloadRequirement } from "@/extensions/health_check/utils/modRequirements/onDownloadRequirement";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import { setModRequirementHidden } from "../../actions/persistent";
import { MOD_REQUIREMENTS_CHECK_ID } from "../../checks/modRequirementsCheck";
import { DetailView } from "../../components/mod_requirement/DetailView";
import { ListingRow } from "../../components/mod_requirement/ListingRow";
import { allModRequirements } from "../../selectors";
import type { IModRequirementExt } from "../../types";
import { isModHidden } from "./modRequirementEntries";
import type { IBulkInstallItem, IHealthCheckContent } from "./types";

export const modRequirementsContent: IHealthCheckContent = {
  selectEntries: (state) =>
    allModRequirements(state).map((mod) => ({
      id: `${mod.requiredBy.modId}-${mod.uid || `${mod.gameId}-${mod.modId || mod.modName}`}`,
      checkId: MOD_REQUIREMENTS_CHECK_ID,
      severity: "suggestion",
      data: mod,
    })),
  ListingRow,
  DetailView,
  supportsHide: true,
  isHidden: (state, entry) => isModHidden(state, entry.data as IModRequirementExt),
  toggleHide: (api, entry) => {
    const mod = entry.data as IModRequirementExt;
    const hidden = isModHidden(api.getState(), mod);
    api.store?.dispatch(setModRequirementHidden(mod.requiredBy.modId, mod.id, !hidden));
  },
  // Active (non-hidden) Nexus requirements that can be downloaded in-app; external
  // requirements have no auto-download and are excluded.
  collectInstallAll: (state: IState, api: IExtensionApi): IBulkInstallItem[] =>
    allModRequirements(state)
      .filter((mod) => !isModHidden(state, mod) && !mod.externalRequirement)
      .map((mod) => ({
        key: mod.uid || `${mod.gameId}-${mod.modId}`,
        install: () => {
          void onDownloadRequirement(api, mod);
        },
      })),
};
