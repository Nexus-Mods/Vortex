import {
  mdiGog,
  mdiMicrosoftXbox,
  mdiHelp,
  mdiSteam,
  mdiUbisoft,
} from "@mdi/js";
import React, { type ButtonHTMLAttributes, type FC } from "react";

import {
  nxmElectronicArts,
  nxmEpicGames,
} from "../../../ui/lib/icon_paths/icon-paths";
// import { Icon } from "../../../tailwind/components/next/icon";
import { joinClasses } from "../../../ui/utils/join_classes";

// Fallback for stores without specific icons
const _DEFAULT_STORE_ICON = mdiHelp;

// Map store IDs to icon paths
// Since we can have custom game stores,
// we should provide for the IGameStore interface to
// optionally specify its own icon in the future
const _STORE_ICONS: Record<string, string> = {
  steam: mdiSteam,
  epic: nxmEpicGames,

  gog: mdiGog,
  xbox: mdiMicrosoftXbox,
  origin: nxmElectronicArts,
  uplay: mdiUbisoft,
};

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  imageSrc: string;
  isActive?: boolean;
  store?: string;
}

export const GameButton: FC<GameButtonProps> = ({
  imageSrc,
  isActive,
  store: _store,
  ...props
}) => {
  // TODO: Re-enable store icon
  // const storeIcon = _store ? (STORE_ICONS[_store] ?? DEFAULT_STORE_ICON) : null;

  return (
    <button
      className="group relative size-12 shrink-0 overflow-hidden rounded-lg"
      {...props}
    >
      <img
        alt=""
        className="absolute inset-0 size-full object-cover"
        src={imageSrc}
      />

      <span
        className={joinClasses([
          "absolute inset-0 z-1 rounded-lg transition-colors",
          isActive
            ? "border-2 border-neutral-strong"
            : "border border-stroke-weak group-hover:border-2 group-hover:border-neutral-strong",
        ])}
      />

      {/* TODO: Re-enable store icon
      {storeIcon !== null && (
        <span className="absolute top-0 left-0 z-2 flex size-4 items-center justify-center rounded-br-md bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
          <Icon className="text-white" path={storeIcon} size="xs" />
        </span>
      )}
      */}
    </button>
  );
};
