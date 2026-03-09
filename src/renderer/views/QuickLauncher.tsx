import React from "react";
import { DropdownButton, MenuItem } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { pathToFileURL } from "url";

import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
import type { IState } from "../types/IState";

import { unknownToError } from "@vortex/shared";
import EmptyPlaceholder from "../controls/EmptyPlaceholder";
import Spinner from "../controls/Spinner";
import { IconButton } from "../controls/TooltipControls";
import { useExtensionContext } from "../ExtensionProvider";
import { makeExeId } from "../reducers/session";
import Debouncer from "../util/Debouncer";
import { log } from "../util/log";
import { showError } from "../util/message";
import {
  activeGameId,
  activeProfile,
  currentGame,
  currentGameDiscovery,
  knownGames as knownGamesSelector,
  lastActiveProfiles as lastActiveProfilesSelector,
} from "../util/selectors";
import StarterInfo from "../util/StarterInfo";
import { truthy } from "../util/util";

type IGameIconCache = { [gameId: string]: { icon: string; game: IGameStored } };

export const QuickLauncher: React.FC = () => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  const { t } = useTranslation(["common"]);

  // Redux state
  const gameMode = useSelector(activeGameId);
  const game = useSelector(currentGame);
  const gameDiscovery = useSelector(currentGameDiscovery);
  const discoveredTools = useSelector(
    (state: IState) =>
      state.settings?.gameMode?.discovered?.[gameMode ?? ""]?.tools ?? {},
    shallowEqual,
  );
  const primaryToolId = useSelector(
    (state: IState) => state.settings?.interface?.primaryTool?.[gameMode ?? ""],
  );
  const knownGames = useSelector(knownGamesSelector);
  const profiles = useSelector(
    (state: IState) => state.persistent?.profiles ?? {},
    shallowEqual,
  );
  const discoveredGames = useSelector(
    (state: IState) => state.settings?.gameMode?.discovered ?? {},
    shallowEqual,
  );
  const profilesVisible = useSelector(
    (state: IState) => state.settings?.interface?.profilesVisible ?? false,
  );
  const lastActiveProfile = useSelector(lastActiveProfilesSelector);
  const toolsRunning = useSelector(
    (state: IState) => state.session?.base?.toolsRunning ?? {},
    shallowEqual,
  );

  // Derived state - gameIconCache with debouncing
  const [gameIconCache, setGameIconCache] = React.useState<IGameIconCache>(
    () => {
      const managedGamesIds = Array.from(
        new Set<string>(
          Object.keys(profiles)
            .map((profileId) => profiles[profileId].gameId)
            .filter((gameId) => truthy(discoveredGames[gameId]?.path)),
        ),
      );

      return managedGamesIds.reduce((prev, gameId) => {
        const knownGame = knownGames.find((iter) => iter.id === gameId);
        if (knownGame === undefined || discoveredGames[gameId] === undefined) {
          return prev;
        }
        prev[gameId] = {
          icon: StarterInfo.getGameIcon(knownGame, discoveredGames[gameId]),
          game: knownGame,
        };
        return prev;
      }, {} satisfies IGameIconCache);
    },
  );

  // Refs for debouncer - store latest dependencies
  const depsRef = React.useRef({ profiles, discoveredGames, knownGames });
  depsRef.current = { profiles, discoveredGames, knownGames };

  const cacheDebouncer = React.useRef<Debouncer>(
    new Debouncer(() => {
      const {
        profiles: p,
        discoveredGames: dg,
        knownGames: kg,
      } = depsRef.current;
      const managedGamesIds = Array.from(
        new Set<string>(
          Object.keys(p)
            .map((profileId) => p[profileId].gameId)
            .filter((gameId) => truthy(dg[gameId]?.path)),
        ),
      );

      const newCache = managedGamesIds.reduce((prev, gameId) => {
        const knownGame = kg.find((iter) => iter.id === gameId);
        if (knownGame === undefined || dg[gameId] === undefined) {
          return prev;
        }
        prev[gameId] = {
          icon: StarterInfo.getGameIcon(knownGame, dg[gameId]),
          game: knownGame,
        };
        return prev;
      }, {} satisfies IGameIconCache);

      setGameIconCache(newCache);
      return Promise.resolve();
    }, 100),
  );

  // Derived state - starter computed via useMemo
  const starter = React.useMemo((): StarterInfo | undefined => {
    if (
      gameDiscovery === undefined ||
      gameDiscovery.path === undefined ||
      (game === undefined && gameDiscovery.id === undefined)
    ) {
      return undefined;
    }

    try {
      const foundGameSupportedTools = primaryToolId
        ? game.supportedTools?.find((tool) => tool.id === primaryToolId)
        : undefined;
      const foundDiscoveredTool = primaryToolId
        ? Object.values(discoveredTools).find(
            (tool) => tool.id === primaryToolId,
          )
        : undefined;
      if (
        primaryToolId == undefined ||
        (!foundGameSupportedTools && !foundDiscoveredTool)
      ) {
        return new StarterInfo(game, gameDiscovery);
      } else {
        try {
          if (foundDiscoveredTool.path !== undefined) {
            return new StarterInfo(
              game,
              gameDiscovery,
              game !== undefined ? foundGameSupportedTools : undefined,
              foundDiscoveredTool,
            );
          } else {
            throw new Error("invalid path to primary tool");
          }
        } catch (err) {
          log("warn", "invalid primary tool", { err });
          return new StarterInfo(game, gameDiscovery);
        }
      }
    } catch (unknownError) {
      const err = unknownToError(unknownError);
      log("error", "failed to create quick launcher entry", {
        error: err.message,
        stack: err.stack,
      });
      return undefined;
    }
  }, [game, gameDiscovery, primaryToolId, discoveredTools]);

  const onShowError = React.useCallback(
    (message: string, details?: string | Error, allowReport?: boolean) => {
      showError(dispatch, message, details, { allowReport });
    },
    [dispatch],
  );

  const start = React.useCallback(() => {
    if (starter?.exePath === undefined) {
      onShowError(
        "Tool missing/misconfigured",
        "Please ensure that the tool/game is configured correctly and try again",
        false,
      );
      return;
    }
    api.events.emit("analytics-track-click-event", "Header", "Play game");
    const state = api.getState();
    const profile = activeProfile(state);
    const currentModsState = profile?.modState ?? {};
    // Get total number of enabled mods (this includes collections)
    const enabledMods = Object.keys(currentModsState).filter(
      (modId) => currentModsState?.[modId]?.enabled ?? false,
    );
    const gameMods = state.persistent.mods[profile.gameId] || {};
    const collections = Object.values(gameMods)
      .filter((val) => val.type == "collection")
      .map((val) => val.id);
    const enabledCollections = collections.filter((collectionId) =>
      enabledMods.includes(collectionId),
    );

    const numberOfEnabledCollections = enabledCollections.length;
    const numberOfEnabledModsExcludingCollections =
      enabledMods.length - numberOfEnabledCollections;
    log(
      "info",
      `Enabled mods at game launch: ${numberOfEnabledModsExcludingCollections}`,
    );
    log(
      "info",
      `Enabled collections at game launch: ${numberOfEnabledCollections}`,
    );

    StarterInfo.run(starter, api, onShowError);
  }, [starter, api, onShowError]);

  const changeGame = React.useCallback(
    (gameId: unknown) => {
      if (gameId === "__more") {
        api.events.emit("show-main-page", "Games");
      } else {
        api.events.emit("activate-game", gameId);
      }
    },
    [api],
  );

  const renderGameOption = React.useCallback(
    (gameId: string) => {
      if (gameIconCache === undefined || gameIconCache[gameId] === undefined) {
        log("error", "failed to access game icon", { gameId });
        return "";
      }

      const discovered = discoveredGames[gameId];

      const iconPath =
        gameIconCache[gameId].icon !== undefined
          ? pathToFileURL(gameIconCache[gameId].icon).href.replace("'", "%27")
          : undefined;
      const cachedGame = gameIconCache[gameId].game;

      const profile = profiles[lastActiveProfile[gameId]];

      let displayName =
        discovered?.shortName ??
        cachedGame?.shortName ??
        discovered?.name ??
        cachedGame?.name;

      if (displayName !== undefined) {
        displayName = displayName.replace(/\t/g, " ");
      }

      return (
        <div
          className="tool-icon-container"
          style={{ background: `url('${iconPath}')` }}
        >
          <div className="quicklaunch-item">
            <div className="quicklaunch-name">{t(displayName)}</div>

            {profilesVisible ? (
              <div className="quicklaunch-profile">
                {t("Profile")} : {profile?.name ?? t("<None>")}
              </div>
            ) : null}
          </div>
        </div>
      );
    },
    [
      gameIconCache,
      discoveredGames,
      profiles,
      lastActiveProfile,
      profilesVisible,
      t,
    ],
  );

  const renderGameOptions = React.useCallback(() => {
    if (Object.keys(gameIconCache).length === 1) {
      return (
        <MenuItem disabled={true} key="no-other-games">
          <EmptyPlaceholder
            icon="layout-list"
            text={t("No other games managed")}
          />
        </MenuItem>
      );
    }

    return Object.keys(gameIconCache)
      .filter((gameId) => gameId !== game?.id)
      .filter((gameId) => !(discoveredGames?.[gameId]?.hidden ?? false))
      .map((gameId) => (
        <MenuItem eventKey={gameId} key={gameId}>
          {renderGameOption(gameId)}
        </MenuItem>
      ));
  }, [gameIconCache, game, discoveredGames, t, renderGameOption]);

  // Update game icon cache when profiles or discovered games change
  React.useEffect(() => {
    cacheDebouncer.current.schedule();
  }, [profiles, discoveredGames]);

  // Event listeners
  React.useEffect(() => {
    api.events.on("quick-launch", start);
    return () => {
      api.events.removeListener("quick-launch", start);
    };
  }, [api, start]);

  if (starter === undefined) {
    return null;
  }

  const exclusiveRunning =
    Object.keys(toolsRunning).find((exeId) => toolsRunning[exeId].exclusive) !==
    undefined;
  const primaryRunning =
    truthy(starter.exePath) &&
    Object.keys(toolsRunning).find(
      (exeId) => exeId === makeExeId(starter.exePath),
    ) !== undefined;

  return (
    <div className="container-quicklaunch">
      <DropdownButton
        className="btn-quicklaunch"
        id="dropdown-quicklaunch"
        key={game.id}
        noCaret={true}
        title={renderGameOption(game.id)}
        onSelect={changeGame}
      >
        {renderGameOptions()}
      </DropdownButton>

      <div className="container-quicklaunch-launch">
        {exclusiveRunning || primaryRunning ? (
          <Spinner />
        ) : (
          <IconButton
            icon="launch-application"
            id="btn-quicklaunch-play"
            tooltip={t("Launch")}
            onClick={start}
          />
        )}
      </div>
    </div>
  );
};

export default QuickLauncher;
