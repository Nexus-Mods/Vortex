import { onDownloadRequirement } from "@/extensions/health_check/utils/modRequirements/onDownloadRequirement";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import { setModRequirementHidden } from "../../actions/persistent";
import { MOD_REQUIREMENTS_CHECK_ID } from "../../checks/modRequirementsCheck";
import { DetailView } from "../../components/mod_requirement/DetailView";
import { ListingRow } from "../../components/mod_requirement/ListingRow";
import { allModRequirements, hiddenModRequirements } from "../../selectors";
import type { IModRequirementExt } from "../../types";
import { checkNameForCheck } from "../../utils/shared/tracking";
import type { IBulkInstallItem, IHealthCheckContent } from "./types";

/**
 * Listing-entry id for a mod requirement — also the issue_id the analytics events report,
 * so the bulk-install path can attribute an install to the same entry the listing shows.
 */
const modEntryId = (mod: IModRequirementExt): string =>
  `${mod.requiredBy.modId}-${mod.uid || `${mod.gameId}-${mod.modId || mod.modName}`}`;

const isModHidden = (
  state: Parameters<typeof hiddenModRequirements>[0],
  mod: IModRequirementExt,
): boolean => (hiddenModRequirements(state)[mod.requiredBy.modId] || []).includes(mod.id);

export const modRequirementsContent: IHealthCheckContent = {
  selectEntries: (state) =>
    allModRequirements(state).map((mod) => ({
      id: modEntryId(mod),
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
          void onDownloadRequirement(api, mod, undefined, {
            issue_id: modEntryId(mod),
            check_id: checkNameForCheck(MOD_REQUIREMENTS_CHECK_ID),
          });
        },
      })),
};
