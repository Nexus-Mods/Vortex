import {
  mdiMenuOpen,
  mdiMenuClose,
  mdiBell,
  mdiHelpCircleOutline,
} from "@mdi/js";
import React, {
  type CSSProperties,
  type FC,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "../../../../types/IState";

import { Typography } from "../../../../tailwind/components/next/typography";
import { useWindowContext } from "../../../contexts";
import { useSpineContext } from "../SpineContext";
import { IconButton } from "./IconButton";
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

  return (
    <div
      className="flex h-11 items-center justify-between pl-4"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <div
        className="flex items-center gap-x-1"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      >
        <IconButton
          iconPath={menuIsCollapsed ? mdiMenuClose : mdiMenuOpen}
          title={menuIsCollapsed ? "Open menu" : "Collapse menu"}
          onClick={handleToggleMenu}
        />

        <Typography className="truncate leading-5 font-semibold">
          {title}
        </Typography>
      </div>

      <div
        className="flex items-center gap-x-4"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      >
        <PremiumIndicator />

        <div className="flex gap-x-2">
          <IconButton iconPath={mdiBell} title="Notifications" />

          <IconButton iconPath={mdiHelpCircleOutline} title="Help" />

          <ProfileSection />
        </div>

        <div className="h-6 w-px bg-stroke-weak" />

        <WindowControls />
      </div>
    </div>
  );
};
