import { mdiAlertOutline, mdiOpenInNew } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";

import type { IState } from "../../../types/api";
import { activeGameId, gameById } from "../../../util/selectors";

export default function MediaVideoSteamFailed() {
  const { t } = useTranslation("media_page");
  const gameId = useSelector(activeGameId);
  const game = useSelector((state: IState) => gameById(state, gameId));
  const steamAppId = (game.details as { steamAppId?: string | undefined })?.steamAppId;
  const steamUri = steamAppId
    ? `steam://open/screenshots/${steamAppId}`
    : "steam://open/screenshots/";

  return (
    <div className="flex min-h-130 w-full flex-col items-center justify-center gap-2 bg-surface-mid">
      <div className="flex gap-2">
        <Icon className="nxm-alert-icon inline" path={mdiAlertOutline} size="sm" />

        <Typography appearance="strong" brand="warning">
          {t("single::steam_clip_unplayable")}
        </Typography>
      </div>

      <Button
        appearance="strong"
        brand="info"
        leftIconPath={mdiOpenInNew}
        type="button"
        onClick={() => window.api.shell.openUrl(steamUri)}
      >
        {t("single::actions::open_in_steam")}
      </Button>
    </div>
  );
}
