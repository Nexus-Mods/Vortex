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
import { joinClasses } from "../../../ui/utils/joinClasses";
import { useGameImage } from "./utils";

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

/** Deterministic hue from a string, for the letter-avatar background. */
function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  cacheKey: string;
  isActive?: boolean;
  preferred?: string;
  sources?: string[];
  store?: string;
}

export const GameButton: FC<GameButtonProps> = ({
  cacheKey,
  isActive,
  preferred,
  sources = [],
  store: _store,
  title,
  ...props
}) => {
  // TODO: Re-enable store icon
  // const storeIcon = _store ? (STORE_ICONS[_store] ?? DEFAULT_STORE_ICON) : null;

  const { src, exhausted, onError, onLoad } = useGameImage(
    cacheKey,
    sources,
    preferred,
  );

  return (
    <button
      className="group relative size-12 shrink-0 overflow-hidden rounded-lg"
      title={title}
      {...props}
    >
      {exhausted ? (
        <span
          className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white"
          style={{
            backgroundColor: `hsl(${stringToHue(title ?? "")}, 40%, 35%)`,
          }}
        >
          {title?.charAt(0)?.toUpperCase() ?? "?"}
        </span>
      ) : (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          src={src}
          onError={onError}
          onLoad={onLoad}
        />
      )}

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
