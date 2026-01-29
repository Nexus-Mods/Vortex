import { mdiDownload, mdiHome, mdiPlus, mdiPuzzle } from "@mdi/js";
import * as path from "path";
import React, { useCallback, useMemo, type ButtonHTMLAttributes } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as url from "url";

import type { IDiscoveryResult } from "../../../extensions/gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../../../extensions/gamemode_management/types/IGameStored";
import type { IState } from "../../../types/IState";

import { setOpenMainPage } from "../../../actions/session";
import { Icon } from "../../../tailwind/components/next/icon";
import { joinClasses } from "../../../tailwind/components/next/utils";
import { useSpineContext } from "./SpineContext";

const Button = ({
  className,
  iconPath,
  isActive,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  iconPath: string;
  isActive?: boolean;
}) => (
  <button
    className={joinClasses([
      className,
      "flex size-12 items-center justify-center transition-colors",
      "hover:border-neutral-strong hover:bg-surface-translucent-low hover:text-neutral-strong",
      isActive
        ? "border-neutral-strong bg-surface-translucent-low text-neutral-strong"
        : "border-stroke-weak",
    ])}
    {...props}
  >
    <Icon className="transition-colors" path={iconPath} size="lg" />
  </button>
);

const GameButton = ({
  imageSrc,
  isActive,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  imageSrc: string;
  isActive?: boolean;
}) => (
  <button
    className="group relative size-12 overflow-hidden rounded-lg"
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
  </button>
);

const getGameImageUrl = (
  game: IGameStored,
  discovery: IDiscoveryResult | undefined,
): string | undefined => {
  // Check discovery for custom logo first
  const logo = discovery?.logo ?? game.logo;
  const extensionPath = discovery?.extensionPath ?? game.extensionPath;

  if (extensionPath !== undefined && logo !== undefined) {
    const logoPath = path.join(extensionPath, logo);
    return url.pathToFileURL(logoPath).href;
  }

  // Fall back to imageURL (remote URL)
  if (game.imageURL !== undefined) {
    return game.imageURL;
  }

  return undefined;
};

export const Spine = () => {
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
        <Button
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
            title={game.name}
            onClick={() => selectGame(game.id)}
          />
        ))}

        <Button
          className="rounded-lg border-2 border-dotted text-neutral-moderate hover:border-solid"
          iconPath={mdiPlus}
          isActive={mainPage === "Games"}
          title="Games"
          onClick={() => handleGlobalPageClick("Games")}
        />
      </div>

      <div className="flex flex-col gap-y-3">
        <Button
          className="rounded-lg text-neutral-moderate hover:border-2"
          iconPath={mdiPuzzle}
          isActive={mainPage === "Extensions"}
          title="Extensions"
          onClick={() => handleGlobalPageClick("Extensions")}
        />

        <Button
          className="rounded-full border-2 text-neutral-strong"
          iconPath={mdiDownload}
          isActive={mainPage === "Downloads"}
          title="Downloads"
          onClick={() => dispatch(setOpenMainPage("Downloads", false))}
        />
      </div>
    </div>
  );
};
