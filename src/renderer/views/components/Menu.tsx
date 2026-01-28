import {
  mdiGamepadSquare,
  mdiViewDashboard,
  mdiPuzzle,
  mdiCog,
  mdiDownload,
} from "@mdi/js";
import React, { type ButtonHTMLAttributes } from "react";

import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import { joinClasses } from "../../../tailwind/components/next/utils";
import { useWindowContext } from "../../../util/WindowContext";

const Button = ({
  children,
  iconPath,
  isActive,
  isCollapsed,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  iconPath: string;
  isActive?: boolean;
  isCollapsed?: boolean;
}) => {
  const { isMenuOpen } = useWindowContext();

  return (
    <button
      className={joinClasses([
        "flex h-10 items-center gap-x-3 rounded-lg transition-colors hover:bg-surface-low hover:text-neutral-moderate",
        isActive
          ? "bg-surface-low text-neutral-moderate"
          : "text-neutral-subdued",
        isMenuOpen ? "px-3" : "w-10 justify-center",
      ])}
      {...props}
    >
      <Icon className="shrink-0" path={iconPath} size="sm" />

      {isMenuOpen && (
        <Typography
          appearance="none"
          as="span"
          className="truncate font-semibold"
          typographyType="body-sm"
        >
          {children}
        </Typography>
      )}
    </button>
  );
};

export const Menu = () => {
  const { isMenuOpen } = useWindowContext();

  return (
    <div
      className={joinClasses([
        "flex shrink-0 flex-col gap-y-0.5 px-3 pt-3",
        isMenuOpen ? "w-56" : "w-16",
      ])}
    >
      <Button iconPath={mdiViewDashboard} isActive={true}>
        Dashboard
      </Button>

      <Button iconPath={mdiGamepadSquare}>Games</Button>

      <Button iconPath={mdiPuzzle}>Extensions</Button>

      <Button iconPath={mdiCog}>Settings</Button>

      <Button iconPath={mdiDownload}>Downloads</Button>
    </div>
  );
};
