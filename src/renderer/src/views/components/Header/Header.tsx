import React, { type FC, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useWindowContext } from "@/contexts";
import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { nxmPanelClose, nxmPanelOpen } from "@/ui/icon-paths";

import {
  activeProfile as activeProfileSelector,
  gameProfiles as gameProfilesSelector,
  knownGames as knownGamesSelector,
} from "../../../util/selectors";
import { useSpineContext } from "../Spine/SpineContext";
import { PremiumIndicator } from "./premium/PremiumIndicator";
import { ProfileSection } from "./profile/ProfileSection";
import { StagingIndicator } from "./StagingIndicator";
import { VersionIndicator } from "./VersionIndicator";
import { WindowControls } from "./WindowControls";

export const Header: FC<React.PropsWithChildren<unknown>> = () => {
  const { menuIsCollapsed, setMenuIsCollapsed } = useWindowContext();
  const { t } = useTranslation();
  const { selection } = useSpineContext();
  const knownGames = useSelector(knownGamesSelector);
  const activeProfile = useSelector(activeProfileSelector);
  const gameProfiles = useSelector(gameProfilesSelector);

  const title = useMemo(() => {
    if (selection.type === "home") {
      return t("Home");
    }
    if (selection.type === "downloads") {
      return t("Downloads");
    }
    const game = knownGames.find((g) => g.id === selection.gameId);
    return game?.name ?? t("Home");
  }, [selection, knownGames, t]);

  const handleToggleMenu = useCallback(() => {
    setMenuIsCollapsed((prev) => !prev);
  }, [setMenuIsCollapsed]);

  const profileName = useMemo(() => {
    if (selection.type !== "game" || !activeProfile) {
      return undefined;
    }
    return gameProfiles.length > 1 ? activeProfile.name : undefined;
  }, [selection, activeProfile, gameProfiles]);

  return (
    <div
      className="flex h-11 items-center justify-between gap-x-6 pl-4.5"
      style={{ WebkitAppRegion: "drag" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-x-1">
        <Tooltip content={menuIsCollapsed ? t("Open menu") : t("Collapse menu")} placement="right">
          <Button
            appearance="weak"
            aria-label={menuIsCollapsed ? t("Open menu") : t("Collapse menu")}
            brand="neutral"
            leftIconPath={menuIsCollapsed ? nxmPanelOpen : nxmPanelClose}
            style={{ WebkitAppRegion: "no-drag" }}
            onClick={handleToggleMenu}
          />
        </Tooltip>

        <Typography
          brand="none"
          className="flex grow items-center gap-x-2 overflow-hidden font-semibold whitespace-nowrap"
        >
          <span className="truncate text-neutral-strong">{title}</span>

          {!!profileName && (
            <span className="shrink-9999 truncate text-neutral-subdued">{profileName}</span>
          )}
        </Typography>
      </div>

      <div className="flex shrink-0 items-center gap-x-2" style={{ WebkitAppRegion: "no-drag" }}>
        <StagingIndicator />

        <VersionIndicator />

        <PremiumIndicator />

        <div className="flex items-center gap-x-5">
          <ProfileSection />

          <div className="h-6 w-0.5 rounded-md bg-stroke-weak" />

          <WindowControls />
        </div>
      </div>
    </div>
  );
};
