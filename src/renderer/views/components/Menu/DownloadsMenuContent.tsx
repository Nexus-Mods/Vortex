import { mdiDownload } from "@mdi/js";
import React, { type FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IGameStored } from "../../../extensions/gamemode_management/types/IGameStored";
import type { IState } from "../../../types/IState";

import { Typography } from "../../../ui/components/typography/Typography";
import { joinClasses } from "../../../ui/utils/joinClasses";
import { discovered as discoveredGamesSelector } from "../../../util/selectors";
import { useSpineContext } from "../Spine/SpineContext";
import { getGameImageUrls, useGameImage } from "../Spine/utils";
import { MenuButton } from "./MenuButton";

/** Deterministic hue from a string, for the letter-avatar background. */
function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/** Returns a sorted list of all managed game IDs. */
function useManagedGameIds(): string[] {
  const discoveredGames = useSelector(discoveredGamesSelector);
  const allProfiles = useSelector(
    (state: IState) => state.persistent.profiles ?? {},
  );

  return useMemo(() => {
    const managedIds = new Set<string>();
    for (const profile of Object.values(allProfiles)) {
      const discovery = discoveredGames[profile.gameId];
      if (discovery?.path !== undefined && discovery?.hidden !== true) {
        managedIds.add(profile.gameId);
      }
    }
    return Array.from(managedIds).sort();
  }, [discoveredGames, allProfiles]);
}

const GameMenuEntry: FC<{
  game: IGameStored;
  isActive: boolean;
  onClick: () => void;
}> = ({ game, isActive, onClick }) => {
  const discoveredGames = useSelector(discoveredGamesSelector);
  const { cacheKey, sources, preferred } = getGameImageUrls(
    game,
    discoveredGames[game.id],
  );
  const { src, exhausted, onError, onLoad } = useGameImage(
    cacheKey,
    sources,
    preferred,
  );

  return (
    <button
      className={joinClasses([
        "flex h-10 items-center gap-x-3 rounded-lg px-3 transition-colors hover:bg-surface-mid hover:text-neutral-moderate",
        isActive
          ? "bg-surface-low text-neutral-moderate"
          : "text-neutral-subdued",
      ])}
      title={game.name}
      onClick={onClick}
    >
      {exhausted ? (
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-xs font-bold text-white"
          style={{
            backgroundColor: `hsl(${stringToHue(game.name)}, 40%, 35%)`,
          }}
        >
          {game.name.charAt(0).toUpperCase()}
        </span>
      ) : (
        <img
          alt=""
          className="size-4 shrink-0 rounded-sm object-cover"
          src={src}
          onError={onError}
          onLoad={onLoad}
        />
      )}

      <Typography
        appearance="none"
        as="span"
        className="truncate font-semibold"
        typographyType="body-sm"
      >
        {game.name}
      </Typography>
    </button>
  );
};

export const DownloadsMenuContent: FC = () => {
  const { t } = useTranslation();
  const { downloadGameFilter, setDownloadGameFilter } = useSpineContext();
  const managedGameIds = useManagedGameIds();

  const knownGames: IGameStored[] = useSelector(
    (state: IState) => state.session.gameMode?.known ?? [],
  );

  const gamesById = useMemo(() => {
    const map = new Map<string, IGameStored>();
    for (const game of knownGames) {
      map.set(game.id, game);
    }
    return map;
  }, [knownGames]);

  return (
    <>
      <MenuButton
        iconPath={mdiDownload}
        isActive={downloadGameFilter === null}
        onClick={() => setDownloadGameFilter(null)}
      >
        {t("All downloads")}
      </MenuButton>

      {managedGameIds.length > 1 &&
        managedGameIds.map((gameId) => {
          const game = gamesById.get(gameId);
          if (game === undefined) return null;
          return (
            <GameMenuEntry
              game={game}
              isActive={downloadGameFilter === gameId}
              key={gameId}
              onClick={() => setDownloadGameFilter(gameId)}
            />
          );
        })}
    </>
  );
};
