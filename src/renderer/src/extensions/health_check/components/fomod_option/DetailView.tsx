import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { activeGameId } from "@/util/selectors";

import type { IFomodOptionIssue } from "../../checks/fomodOptionsCheck";
import { changeInstallerOptions } from "../../utils/fomodSnapshot/changeInstallerOptions";
import type { IDetailViewProps } from "../../views/content/types";
import { Divider } from "../divider/Divider";

/**
 * One mod's newly available installer options, in detail.
 *
 * The action reopens the mod's installer with its recorded choices preselected. A
 * collection-managed mod gets the explanation but no button: reinstalling it would put the
 * install out of step with the collection, which is a decision the user has to make
 * knowingly rather than by clicking a fix.
 */
export const DetailView = ({ entry, api, onBack }: IDetailViewProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const issue = entry.data as IFomodOptionIssue;
  const gameId = useSelector(activeGameId);
  const [busy, setBusy] = useState(false);

  const handleChangeOptions = async () => {
    const mod =
      gameId !== undefined ? api.getState().persistent.mods[gameId]?.[issue.modId] : undefined;
    if (mod === undefined) {
      return;
    }
    setBusy(true);
    try {
      const changed = await changeInstallerOptions(api, mod);
      if (changed) {
        onBack();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-4">
      <Typography typographyType="body-lg">{issue.modName}</Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        {t("detail::fomod_options::description")}
      </Typography>

      <Divider variant="and" />

      {issue.options.map((option, index) => (
        <div
          key={`${option.groupName}-${option.optionName}-${index}`}
          className="flex flex-col gap-y-1"
        >
          <Typography typographyType="body-sm">{option.optionName}</Typography>
          <Typography appearance="subdued" typographyType="body-sm">
            {t("detail::fomod_options::option_reason", {
              groupName: option.groupName,
              reason: option.reason,
            })}
          </Typography>
        </div>
      ))}

      <Divider variant="and" />

      {issue.collectionManaged ? (
        <Typography appearance="subdued" typographyType="body-sm">
          {t("detail::fomod_options::collection_managed")}
        </Typography>
      ) : (
        <div>
          <Button
            appearance="moderate"
            brand="neutral"
            disabled={busy}
            leftIcon="tune"
            onClick={() => void handleChangeOptions()}
          >
            {t("detail::fomod_options::change_options")}
          </Button>
        </div>
      )}
    </div>
  );
};
