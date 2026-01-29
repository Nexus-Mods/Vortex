import {
  mdiMenuOpen,
  mdiMenuClose,
  mdiWindowMinimize,
  mdiWindowMaximize,
  mdiWindowClose,
  mdiBell,
  mdiHelpCircleOutline,
  mdiWindowRestore,
} from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "../../../types/IState";

import { Button } from "../../../tailwind/components/next/button";
import { Typography } from "../../../tailwind/components/next/typography";
import { useWindowContext } from "../../../util/WindowContext";
import {
  close,
  minimize,
  toggleMaximize,
  useIsMaximized,
} from "../../../util/windowManipulation";
import { useSpineContext } from "./SpineContext";

export const Header = () => {
  const { t } = useTranslation();
  const { isMenuOpen, setIsMenuOpen } = useWindowContext();
  const { selection } = useSpineContext();
  const knownGames = useSelector(
    (state: IState) => state.session.gameMode.known,
  );

  const isMaximized = useIsMaximized();

  const title = React.useMemo(() => {
    if (selection.type === "home") {
      return t("Home");
    }
    const game = knownGames.find((g) => g.id === selection.gameId);
    return game?.name ?? t("Home");
  }, [selection, knownGames, t]);

  return (
    <div className="flex h-12 items-center justify-between pr-3 pl-4.5">
      <div className="flex items-center gap-x-2.5">
        <Button
          buttonType="tertiary"
          leftIconPath={isMenuOpen ? mdiMenuOpen : mdiMenuClose}
          size="sm"
          title={isMenuOpen ? "Collapse menu" : "Open menu"}
          onClick={() => setIsMenuOpen((open) => !open)}
        />

        <Typography appearance="moderate" className="truncate font-semibold">
          {title}
        </Typography>
      </div>

      <div className="flex items-center gap-x-8">
        <div className="flex gap-x-3">
          <Button
            buttonType="tertiary"
            leftIconPath={mdiBell}
            size="sm"
            title="Notifications"
          />

          <Button
            buttonType="tertiary"
            leftIconPath={mdiHelpCircleOutline}
            size="sm"
            title="Questions"
          />
        </div>

        <div className="flex gap-x-3">
          <Button
            buttonType="tertiary"
            leftIconPath={mdiWindowMinimize}
            size="sm"
            title="Minimize"
            onClick={minimize}
          />

          <Button
            buttonType="tertiary"
            leftIconPath={isMaximized ? mdiWindowRestore : mdiWindowMaximize}
            size="sm"
            title={isMaximized ? "Restore" : "Maximize"}
            onClick={toggleMaximize}
          />

          <Button
            buttonType="tertiary"
            leftIconPath={mdiWindowClose}
            size="sm"
            title="Close"
            onClick={close}
          />
        </div>
      </div>
    </div>
  );
};
