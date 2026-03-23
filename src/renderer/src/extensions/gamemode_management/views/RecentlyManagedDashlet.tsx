import Dashlet from "../../../controls/Dashlet";
import Placeholder from "../../../controls/EmptyPlaceholder";
import { MainContext } from "../../../views/MainWindow";
import type { IProfile, IState } from "../../../types/IState";
import { getSafe } from "../../../util/storeHelper";

import { activeGameId } from "../../profile_management/selectors";

import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";

import GameThumbnail from "./GameThumbnail";

import PromiseBB from "bluebird";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

function RecentlyManagedDashlet() {
  const [t] = useTranslation(["common"]);
  const { api } = React.useContext(MainContext);

  const gameMode = useSelector<IState, string>((state) => activeGameId(state));
  const knownGames = useSelector<IState, IGameStored[]>(
    (state) => state.session.gameMode.known,
  );
  const discoveredGames = useSelector<
    IState,
    { [id: string]: IDiscoveryResult }
  >((state) => state.settings.gameMode.discovered);
  const lastActiveProfile = useSelector<IState, { [gameId: string]: string }>(
    (state) => state.settings.profiles.lastActiveProfile,
  );
  const profiles = useSelector<IState, { [id: string]: IProfile }>(
    (state) => state.persistent.profiles,
  );

  const games = React.useMemo(() => {
    const lastManaged = (id: string) =>
      getSafe(
        profiles,
        [getSafe(lastActiveProfile, [id], undefined), "lastActivated"],
        0,
      );

    return knownGames
      .filter(
        (game) =>
          game.id !== gameMode &&
          lastManaged(game.id) !== 0 &&
          getSafe(discoveredGames, [game.id, "path"], undefined) !== undefined,
      )
      .sort((lhs, rhs) => lastManaged(rhs.id) - lastManaged(lhs.id))
      .slice(0, 3);
  }, [knownGames, gameMode, discoveredGames, lastActiveProfile, profiles]);

  const analyticsTrack = React.useCallback(() => {
    api?.events.emit("analytics-track-click-event", "Dashboard", "Recent game");
  }, [api]);

  const refreshGameInfo = React.useCallback(
    (gameId: string) => {
      return new PromiseBB<void>((resolve, reject) => {
        api?.events.emit("refresh-game-info", gameId, (err: Error | null) => {
          if (err !== null) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    },
    [api],
  );

  let content: JSX.Element;
  if (games.length === 0) {
    content = (
      <Placeholder
        icon="game"
        text={t("You don't have any recently managed games")}
        fill
      />
    );
  } else {
    content = (
      <div className="list-recently-managed">
        {games.map((game) => (
          <div
            key={game.id}
            className="recently-managed-analytics-click"
            onClick={analyticsTrack}
          >
            <GameThumbnail
              t={t}
              game={game}
              type="managed"
              active={false}
              onRefreshGameInfo={refreshGameInfo}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Dashlet title={t("Recently Managed")} className="dashlet-recently-managed">
      {content}
    </Dashlet>
  );
}

export default RecentlyManagedDashlet;
