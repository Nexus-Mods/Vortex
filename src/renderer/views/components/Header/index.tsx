import React, { type FC, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "../../../types/IState";

import { Typography } from "../../../tailwind/components/next/typography";
import { nxmPanelClose, nxmPanelOpen } from "../../../tailwind/lib/icon-paths";
import { useWindowContext } from "../../../contexts";
import { useSpineContext } from "../Spine/SpineContext";
import { HelpSection } from "./HelpSection";
import { IconButton } from "./IconButton";
import { Notifications } from "./Notifications";
import { PremiumIndicator } from "./PremiumIndicator";
import { ProfileSection } from "./ProfileSection";
import { WindowControls } from "./WindowControls";

export const Header: FC = () => {
  const { menuIsCollapsed, setMenuIsCollapsed } = useWindowContext();
  const { t } = useTranslation();
  const { selection } = useSpineContext();
  const knownGames = useSelector(
    (state: IState) => state.session.gameMode.known,
  );
  const activeProfileId = useSelector(
    (state: IState) => state.settings.profiles.activeProfileId,
  );
  const activeProfile = useSelector(
    (state: IState) => state.persistent.profiles[activeProfileId],
  );
  const profiles = useSelector((state: IState) => state.persistent.profiles);

  const title = useMemo(() => {
    if (selection.type === "home") {
      return t("Home");
    }
    const game = knownGames.find((g) => g.id === selection.gameId);
    return game?.name ?? t("Home");
  }, [selection, knownGames, t]);

  const handleToggleMenu = useCallback(() => {
    setMenuIsCollapsed((prev) => !prev);
  }, [setMenuIsCollapsed]);

  const profileName = useMemo(() => {
    if (selection.type === "home" || !activeProfile) {
      return undefined;
    }
    const gameProfiles = Object.values(profiles).filter(
      (p) => p.gameId === activeProfile.gameId,
    );
    return gameProfiles.length > 1 ? activeProfile.name : undefined;
  }, [selection, activeProfile, profiles]);

  return (
    <div
      className="flex h-11 items-center justify-between pl-4.5"
      style={{ WebkitAppRegion: "drag" }}
    >
      <div
        className="flex items-center gap-x-1"
        style={{ WebkitAppRegion: "no-drag" }}
      >
        <IconButton
          iconPath={menuIsCollapsed ? nxmPanelOpen : nxmPanelClose}
          title={menuIsCollapsed ? "Open menu" : "Collapse menu"}
          onClick={handleToggleMenu}
        />

        <Typography
          appearance="none"
          className="flex items-center gap-x-2 truncate leading-5 font-semibold"
        >
          <span className="text-neutral-strong">{title}</span>

          {profileName && (
            <span className="text-neutral-subdued">{profileName}</span>
          )}
        </Typography>
      </div>

      <div
        className="flex items-center gap-x-4"
        style={{ WebkitAppRegion: "no-drag" }}
      >
        <PremiumIndicator />

        <div className="flex gap-x-2">
          <Notifications />

          <HelpSection />

          <ProfileSection />
        </div>

        <div className="h-6 w-px bg-stroke-weak" />

        <WindowControls />
      </div>
    </div>
  );
};
