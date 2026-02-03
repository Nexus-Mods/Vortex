import { mdiHome, mdiPlus, mdiPuzzle } from "@mdi/js";
import React, { type FC, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../../../types/IState";

import { setOpenMainPage } from "../../../../actions/session";
import { useSpineContext } from "../SpineContext";
import { DownloadButton } from "./DownloadButton";
import { GameButton } from "./GameButton";
import { SpineButton } from "./SpineButton";
import { getGameImageUrl } from "./utils";

export const Spine: FC = () => {
  const { selection, selectHome, selectGame } = useSpineContext();

  const dispatch = useDispatch();

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

  return (
    <div className="flex shrink-0 flex-col justify-between border-r border-stroke-weak p-3">
      <div className="flex flex-col gap-y-3">
        <SpineButton
          className="rounded-lg border-2 text-neutral-moderate"
          iconPath={mdiHome}
          isActive={selection.type === "home"}
          onClick={selectHome}
        />

        {managedGames.map((game) => (
          <GameButton
            imageSrc={getGameImageUrl(game, discoveredGames[game.id])}
            isActive={selection.type === "game" && selection.gameId === game.id}
            key={game.id}
            store={discoveredGames[game.id]?.store}
            title={game.name}
            onClick={() => selectGame(game.id)}
          />
        ))}

        <SpineButton
          className="rounded-lg border-2 border-dotted text-neutral-moderate hover:border-solid"
          iconPath={mdiPlus}
          isActive={mainPage === "Games"}
          title="Games"
          onClick={() => handleGlobalPageClick("Games")}
        />
      </div>

      <div className="flex flex-col gap-y-3">
        <SpineButton
          className="rounded-lg text-neutral-moderate hover:border-2"
          iconPath={mdiPuzzle}
          isActive={mainPage === "Extensions"}
          title="Extensions"
          onClick={() => handleGlobalPageClick("Extensions")}
        />

        <DownloadButton />
      </div>
    </div>
  );
};
