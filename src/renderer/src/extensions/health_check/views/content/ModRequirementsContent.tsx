import { mdiDownload, mdiOpenInNew } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import { setRequirementHidden } from "../../actions/persistent";
import { MOD_REQUIREMENTS_CHECK_ID } from "../../checks/modRequirementsCheck";
import { ModRequirement } from "../../components/mod_requirement/ModRequirement";
import { allModRequirements, hiddenRequirements } from "../../selectors";
import type { IModRequirementExt } from "../../types";
import { onDownloadRequirement } from "../../utils/onDownloadRequirement";
import type { IDetailViewProps, IHealthCheckContent, IListingRowProps } from "./types";

function isModHidden(
  state: Parameters<typeof hiddenRequirements>[0],
  mod: IModRequirementExt,
): boolean {
  return (hiddenRequirements(state)[mod.requiredBy.modId] || []).includes(mod.id);
}

function ModRequirementsListingRow({ entry, isHidden, onOpen, onToggleHide }: IListingRowProps) {
  return (
    <ModRequirement
      isHidden={isHidden}
      requirementInfo={entry.data as IModRequirementExt}
      onClick={onOpen}
      onToggleHide={onToggleHide}
    />
  );
}

function ModRequirementsDetailView({ entry, api }: IDetailViewProps) {
  const { t } = useTranslation("health_check");
  const mod = entry.data as IModRequirementExt;

  return (
    <div className="space-y-4">
      <Typography>{mod.modName}</Typography>

      <div className="flex gap-x-2">
        {mod.modUrl !== undefined && (
          <Button
            appearance="moderate"
            brand="neutral"
            leftIconPath={mdiOpenInNew}
            size="sm"
            onClick={() => window.api.shell.openUrl(mod.modUrl)}
          >
            {t("detail::item::install_via_mod_page")}
          </Button>
        )}

        <Button
          appearance="strong"
          brand="neutral"
          leftIconPath={mdiDownload}
          size="sm"
          onClick={() => void onDownloadRequirement(api, mod)}
        >
          {t("detail::item::install_one_click")}
        </Button>
      </div>
    </div>
  );
}

export const modRequirementsContent: IHealthCheckContent = {
  selectEntries: (state) =>
    allModRequirements(state).map((mod) => ({
      id: `${mod.requiredBy.modId}-${mod.uid || `${mod.gameId}-${mod.modId || mod.modName}`}`,
      checkId: MOD_REQUIREMENTS_CHECK_ID,
      severity: "suggestion",
      data: mod,
    })),
  ListingRow: ModRequirementsListingRow,
  DetailView: ModRequirementsDetailView,
  supportsHide: true,
  isHidden: (state, entry) => isModHidden(state, entry.data as IModRequirementExt),
  toggleHide: (api, entry) => {
    const mod = entry.data as IModRequirementExt;
    const hidden = isModHidden(api.getState(), mod);
    api.store?.dispatch(setRequirementHidden(mod.requiredBy.modId, mod.id, !hidden));
  },
};
