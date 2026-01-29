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

import { Button } from "../../../tailwind/components/next/button";
import { Typography } from "../../../tailwind/components/next/typography";
import { useWindowContext } from "../../../util/WindowContext";
import {
  minimize,
  close,
  toggleMaximize,
  useIsMaximized,
} from "../../../util/windowManipulation";

export const Header = () => {
  const { isMenuOpen, setIsMenuOpen } = useWindowContext();

  const isMaximized = useIsMaximized();

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

        {isMenuOpen && (
          <Typography appearance="moderate" className="truncate font-semibold">
            Home
          </Typography>
        )}
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
