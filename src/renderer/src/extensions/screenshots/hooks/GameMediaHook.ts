import { useCallback, useState, useEffect, useMemo } from "react";
import { useSelector, useStore } from "react-redux";

import type { IState } from "@/types/api";

import { activeGameId, gameById, currentGameDiscovery } from "../../../util/selectors";
import * as sessionActions from "../actions/session";
import type { IGameMediaPersistentState } from "../reducers/persistent";
import type { IGameMediaSessionState } from "../reducers/session";
import collectImages from "../util/collectImages";
import type { MediaItem, MediaSource } from "../util/mediaTypes";
import sourcesByDiscovery from "../util/sourcesByDiscovery";

type IStateWithGameMedia = IState & {
  persistent: { game_media: IGameMediaPersistentState };
} & { session: { game_media: IGameMediaSessionState } };

export default function useGameMedia() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const store = useStore();

  const gameId = useSelector(activeGameId);
  const game = useSelector((state: IState) => gameById(state, gameId));

  const discovery = useSelector(currentGameDiscovery);

  const [defaultSources, setDefaultSources] = useState<Record<string, MediaSource>>({});

  useEffect(() => {
    let active = true;

    if (!gameId || !discovery) {
      setDefaultSources({});
      return;
    }

    const loadDefault = async () => {
      try {
        const res = await sourcesByDiscovery(game, discovery);
        if (!active) return;
        setDefaultSources(res ?? {});
      } catch {
        if (!active) return;
        setDefaultSources({});
      }
    };

    void loadDefault();

    return () => {
      active = false;
    };
  }, [gameId, discovery, game]);

  const customSources: Record<string, MediaSource> | undefined = useSelector(
    (state: IStateWithGameMedia) => state.persistent.game_media.sources?.[gameId],
  );

  const allSources: Record<string, MediaSource> = useMemo(
    () => ({ ...defaultSources, ...(customSources ?? {}) }),
    [defaultSources, customSources],
  );

  const items = useSelector((state: IStateWithGameMedia) => state.session.game_media.items);

  const setItems = useCallback(
    (i: MediaItem[]) => {
      store.dispatch(sessionActions.setFoundGameMedia(i));
    },
    [store],
  );

  useEffect(() => {
    if (!gameId || !discovery) return;
    const loadMedia = async () => {
      console.log("Loading media");
      try {
        const foundItems = await collectImages(allSources);
        setItems(foundItems);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(`Unknwon error`));
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    setIsLoading(true);
    setIsError(false);
    void loadMedia();
  }, [allSources, setItems]);

  const forceCollect = async () => {
    try {
      const res = await collectImages(allSources);
      setItems(res);
    } catch {
      // Do nothing
    }
  };

  return {
    isLoading,
    isError,
    error,
    allSources,
    items,
    discovery,
    forceCollect,
  };
}
