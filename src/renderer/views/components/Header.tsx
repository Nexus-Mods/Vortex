import {
  mdiMenuOpen,
  mdiMenuClose,
  mdiWindowMinimize,
  mdiWindowMaximize,
  mdiWindowClose,
  mdiBell,
  mdiHelpCircleOutline,
} from "@mdi/js";
import React from "react";

import { Button } from "../../../tailwind/components/next/button";
import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import { useWindowContext } from "../../../util/WindowContext";

export const Header = () => {
  const { isMenuOpen, setIsMenuOpen } = useWindowContext();

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
            Skyrim Special Edition
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
          />

          <Button
            buttonType="tertiary"
            leftIconPath={mdiWindowMaximize}
            size="sm"
            title="Maximize"
          />

          <Button
            buttonType="tertiary"
            leftIconPath={mdiWindowClose}
            size="sm"
            title="Close"
          />
        </div>
      </div>
    </div>
  );
};
