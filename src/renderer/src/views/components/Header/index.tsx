import React, { type FC, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useWindowContext } from "@/contexts";
import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { nxmPanelClose, nxmPanelOpen } from "@/ui/icon-paths";

import {
  activeProfile as activeProfileSelector,
  gameProfiles as gameProfilesSelector,
  knownGames as knownGamesSelector,
} from "../../../util/selectors";
import { useSpineContext } from "../Spine/SpineContext";
import { HelpSection } from "./HelpSection";
import { Notifications } from "./Notifications";
import { PremiumIndicator } from "./PremiumIndicator";
import { ProfileSection } from "./ProfileSection";
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
      className="flex h-11 items-center justify-between pl-4.5"
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
          className="flex min-w-0 items-center gap-x-2 truncate font-semibold"
        >
          <span className="shrink-0 text-neutral-strong">{title}</span>

          {!!profileName && (
            <span className="max-w-[33%] min-w-0 truncate text-neutral-subdued">{profileName}</span>
          )}
        </Typography>
      </div>

      <div className="flex shrink-0 items-center gap-x-2" style={{ WebkitAppRegion: "no-drag" }}>
        <StagingIndicator />

        <VersionIndicator />

        <PremiumIndicator />

        <div className="flex items-center gap-x-5">
          <TooltipDelayGroup as="div" className="flex gap-x-2">
            <Notifications />

            <HelpSection />

            <ProfileSection />
          </TooltipDelayGroup>

          <div className="h-6 w-0.5 rounded-md bg-stroke-weak" />

          <WindowControls />
        </div>
      </div>
    </div>
  );
};
