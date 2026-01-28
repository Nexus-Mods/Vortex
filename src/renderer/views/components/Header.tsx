import {
  mdiMenuOpen,
  mdiMenuClose,
  mdiWindowMinimize,
  mdiWindowMaximize,
  mdiWindowClose,
} from "@mdi/js";
import React from "react";

import { Button } from "../../../tailwind/components/next/button";
import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import { useWindowContext } from "../../../util/WindowContext";

export const Header = () => {
  const { isMenuOpen, setIsMenuOpen } = useWindowContext();

  return (
    <div className="flex h-12 items-center justify-between px-6 py-3">
      <div className="flex items-center gap-x-2.5">
        <button
          className="shrink-0 text-neutral-subdued transition-colors hover:text-neutral-moderate"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <Icon path={isMenuOpen ? mdiMenuOpen : mdiMenuClose} />
        </button>

        {isMenuOpen && (
          <Typography appearance="moderate" className="truncate font-semibold">
            Skyrim Special Edition
          </Typography>
        )}
      </div>

      <div>
        <div className="flex gap-x-6">
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
