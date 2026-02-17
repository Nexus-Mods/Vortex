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

import type { IState } from "../../../types/IState";

import { setOpenMainPage } from "../../../actions";
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

  const knownGames = useSelector(
    (state: IState) => state.session.gameMode.known,
  );
  const discoveredGames = useSelector(
    (state: IState) => state.settings.gameMode.discovered,
  );
  const lastActiveProfile = useSelector(
    (state: IState) => state.settings.profiles.lastActiveProfile,
  );
  const mainPage = useSelector((state: IState) => state.session.base.mainPage);

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
        isActive={selection.type === "home"}
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
                  selection.type === "game" && selection.gameId === game.id
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
