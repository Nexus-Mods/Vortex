import { mdiHome, mdiPlus } from "@mdi/js";
import React, {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage } from "../../../actions";
import {
  discovered as discoveredGamesSelector,
  knownGames as knownGamesSelector,
  lastActiveProfiles as lastActiveProfilesSelector,
  mainPage as mainPageSelector,
} from "../../../util/selectors";
import { DownloadButton } from "./DownloadButton";
import { GameButton } from "./GameButton";
import { SpineButton } from "./SpineButton";
import { useSpineContext } from "./SpineContext";
import { getGameImageUrl } from "./utils";

export const Spine: FC = () => {
  const dispatch = useDispatch();
  const { selection, selectHome, selectGame } = useSpineContext();

  const [canScrollUp, setCanScrollUp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const knownGames = useSelector(knownGamesSelector);
  const discoveredGames = useSelector(discoveredGamesSelector);
  const lastActiveProfile = useSelector(lastActiveProfilesSelector);
  const mainPage = useSelector(mainPageSelector);

  // Whether a standalone spine button (Downloads, Games) owns the current page,
  // so the context buttons (Home / Game) should not appear active.
  const isStandalonePageActive =
    mainPage === "Downloads" ||
    mainPage === "game-downloads" ||
    mainPage === "Games";

  const handleGlobalPageClick = useCallback(
    (pageId: string) => {
      // Global pages need Home to be selected first
      selectHome();
      // Then navigate to the specific page (overriding the default Dashboard page)
      dispatch(setOpenMainPage(pageId, false));
    },
    [selectHome, dispatch],
  );

  // Filter to only managed games (have a profile and are discovered)
  const managedGames = useMemo(() => {
    return knownGames.filter((game) => {
      const discovery = discoveredGames[game.id];
      const hasProfile = lastActiveProfile[game.id] !== undefined;
      return (
        hasProfile &&
        discovery?.path !== undefined &&
        discovery?.hidden !== true
      );
    });
  }, [knownGames, discoveredGames, lastActiveProfile]);

  const onScroll = (event: Event) =>
    setCanScrollUp((event.target as HTMLDivElement).scrollTop > 0);

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
        isActive={selection.type === "home" && !isStandalonePageActive}
        onClick={selectHome}
      />

      <div className="relative mt-2 mb-3 flex min-h-0 w-full grow">
        {canScrollUp && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-1 h-6 bg-linear-to-b from-surface-base to-transparent" />
        )}

        <div
          className="min-h-0 w-full overflow-y-auto pt-1 pl-3"
          ref={scrollRef}
        >
          <div className="flex flex-col gap-y-3 pb-6">
            {managedGames.map((game) => (
              <GameButton
                imageSrc={getGameImageUrl(game, discoveredGames[game.id])}
                isActive={
                  selection.type === "game" &&
                  selection.gameId === game.id &&
                  !isStandalonePageActive
                }
                key={game.id}
                store={discoveredGames[game.id]?.store}
                title={game.name}
                onClick={() => selectGame(game.id)}
              />
            ))}

            <SpineButton
              className="border-2 border-dotted hover:border-solid"
              iconPath={mdiPlus}
              isActive={mainPage === "Games"}
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
