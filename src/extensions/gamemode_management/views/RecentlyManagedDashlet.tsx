import Dashlet from "../../../renderer/controls/Dashlet";
import Placeholder from "../../../renderer/controls/EmptyPlaceholder";
import Spinner from "../../../renderer/controls/Spinner";
import { MainContext } from "../../../renderer/views/MainWindow";
import { useQuery } from "../../../renderer/hooks/useQuery";
import type { IState } from "../../../types/IState";

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

  const {
    data: recentGames,
    loading,
    error,
  } = useQuery("recently_managed_games", { current_game_id: gameMode ?? "" });

  const games = React.useMemo(() => {
    if (recentGames === undefined) {
      return [];
    }
    return recentGames
      .map((row) => knownGames.find((g) => g.id === row.game_id))
      .filter(
        (game): game is IGameStored =>
          game !== undefined && discoveredGames[game.id]?.path !== undefined,
      );
  }, [recentGames, knownGames, discoveredGames]);

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
  if (loading) {
    content = <Spinner />;
  } else if (error !== undefined) {
    content = (
      <Placeholder
        icon="feedback-warning"
        text={t("Failed to load recently managed games")}
        fill
      />
    );
  } else if (games.length === 0) {
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
