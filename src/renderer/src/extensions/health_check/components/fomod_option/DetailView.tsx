import React, { useState } from "react";
import { useSelector } from "react-redux";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { activeGameId } from "@/util/selectors";

import { changeInstallerOptions } from "../../../installer_fomod_shared/utils/changeInstallerOptions";
import type { IFomodOptionIssue } from "../../checks/fomodOptionsCheck";
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
  const issue = entry.data as IFomodOptionIssue;
  const gameId = useSelector(activeGameId);
  const [busy, setBusy] = useState(false);

  const handleChangeOptions = async () => {
    const mod =
      gameId !== undefined
        ? api.getState().persistent.mods[gameId as string]?.[issue.modId]
        : undefined;
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
        These options were unavailable when this mod was installed and are available now. Reopening
        the installer keeps everything else as you chose it.
      </Typography>

      <Divider variant="and" />

      {issue.options.map((option, index) => (
        <div
          key={`${option.groupName}-${option.optionName}-${index}`}
          className="flex flex-col gap-y-1"
        >
          <Typography typographyType="body-sm">{option.optionName}</Typography>
          <Typography appearance="subdued" typographyType="body-sm">
            {option.groupName} · available now that {option.reason} is active
          </Typography>
        </div>
      ))}

      <Divider variant="and" />

      {issue.collectionManaged ? (
        <Typography appearance="subdued" typographyType="body-sm">
          This mod is managed by a collection. Changing its options here would make your install
          differ from the collection, so make the change from the collection's own mod page if you
          want it.
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
            Change options
          </Button>
        </div>
      )}
    </div>
  );
};
