import { mdiMenuOpen, mdiMenuClose } from "@mdi/js";
import React from "react";

import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import { useWindowContext } from "../../../util/WindowContext";

export const Header = () => {
  const { isMenuOpen, setIsMenuOpen } = useWindowContext();

  return (
    <div className="flex h-12 items-center justify-between py-3 pr-6 pl-5.5">
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

      <div>Header stuff</div>
    </div>
  );
};
