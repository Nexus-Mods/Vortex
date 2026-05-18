import { mdiHome, mdiPlus } from "@mdi/js";
import React, { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";

import {
  discovered as discoveredGamesSelector,
  knownGames as knownGamesSelector,
  profiles as profilesSelector,
} from "../../../util/selectors";
import { DownloadButton } from "./DownloadButton";
import { GameButton } from "./GameButton";
import { SpineButton } from "./SpineButton";
import { useSpineContext } from "./SpineContext";
import { formatGameDisplayName, getGameImageUrls } from "./utils";

export const Spine: FC = () => {
  const { selection, selectHome, selectGame, selectGlobalPage } = useSpineContext();

  const [canScrollUp, setCanScrollUp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const knownGames = useSelector(knownGamesSelector);
  const discoveredGames = useSelector(discoveredGamesSelector);
  const allProfiles = useSelector(profilesSelector);

  const handleGlobalPageClick = useCallback(
    (pageId: string) => {
      selectGlobalPage(pageId);
    },
    [selectGlobalPage],
  );

  const profileGameIds = useMemo(() => {
    const set = new Set<string>();
    for (const profile of Object.values(allProfiles)) {
      set.add(profile.gameId);
    }
    return set;
  }, [allProfiles]);

  // Filter to only managed games (have a profile and are discovered)
  const managedGames = useMemo(() => {
    return knownGames.filter((game) => {
      const discovery = discoveredGames[game.id];
      return (
        profileGameIds.has(game.id) && discovery?.path !== undefined && discovery?.hidden !== true
      );
    });
  }, [knownGames, discoveredGames, profileGameIds]);

  const onScroll = (event: Event) => setCanScrollUp((event.target as HTMLDivElement).scrollTop > 0);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const element = scrollRef.current;
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  return (
    <div className="box-content flex w-18 shrink-0 flex-col items-center justify-between border-r border-stroke-weak py-3">
      <SpineButton
        className="border-2"
        iconPath={mdiHome}
        isActive={selection.type === "home"}
        title="Home"
        onClick={selectHome}
      />

      <div className="relative mt-2 mb-3 flex min-h-0 w-full grow">
        {canScrollUp && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-1 h-6 bg-linear-to-b from-surface-base to-transparent" />
        )}

        <div className="min-h-0 w-full overflow-y-auto pt-1 pl-3" ref={scrollRef}>
          <div className="flex flex-col gap-y-3 pb-6">
            {managedGames.map((game) => {
              const { cacheKey, sources, preferred } = getGameImageUrls(
                game,
                discoveredGames[game.id],
              );
              return (
                <GameButton
                  cacheKey={cacheKey}
                  isActive={selection.type === "game" && selection.gameId === game.id}
                  key={game.id}
                  preferred={preferred}
                  sources={sources}
                  store={discoveredGames[game.id]?.store}
                  title={formatGameDisplayName(game.name)}
                  onClick={() => selectGame(game.id)}
                />
              );
            })}

            <SpineButton
              className="border-2 border-dotted hover:border-solid"
              iconPath={mdiPlus}
              title="Games"
              onClick={() => handleGlobalPageClick("Games")}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-6 bg-linear-to-t from-surface-base to-transparent" />
      </div>

      <DownloadButton />
    </div>
  );
};
