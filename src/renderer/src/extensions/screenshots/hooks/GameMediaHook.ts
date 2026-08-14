import { useCallback, useState, useEffect, useMemo } from "react";
import { useSelector, useStore } from "react-redux";

import type { IState } from "@/types/api";

import { activeGameId, gameById, currentGameDiscovery } from "../../../util/selectors";
import * as sessionActions from "../actions/session";
import collectImages from "../util/collectImages";
import type { GameMediaItem, GameMediaSource } from "../util/mediaTypes";
import sourcesByDiscovery from "../util/sourcesByDiscovery";
import type { IStateWithGameMedia } from "../util/types";

export default function useGameMedia() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const store = useStore();

  const gameId = useSelector(activeGameId);
  const game = useSelector((state: IState) => gameById(state, gameId));

  const discovery = useSelector(currentGameDiscovery);

  const [defaultSources, setDefaultSources] = useState<Record<string, GameMediaSource>>({});

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

  const customSources: Record<string, GameMediaSource> | undefined = useSelector(
    (state: IStateWithGameMedia) => state.persistent.game_media.sources?.[gameId],
  );

  const disabledSources: string[] = useSelector(
    (state: IStateWithGameMedia) => state.persistent.game_media.disabledSources?.[gameId],
  );

  const allSources: Record<string, GameMediaSource> = useMemo(
    () => ({ ...defaultSources, ...(customSources ?? {}) }),
    [defaultSources, customSources],
  );

  const items = useSelector((state: IStateWithGameMedia) => state.session.game_media.items);

  const setItems = useCallback(
    (i: GameMediaItem[]) => {
      store.dispatch(sessionActions.setFoundGameMedia(i));
    },
    [store],
  );

  useEffect(() => {
    if (!gameId || !discovery) return;
    const loadMedia = async () => {
      // console.log("Loading media");
      try {
        const foundItems = await collectImages(allSources, disabledSources);
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
  }, [allSources, setItems, disabledSources]);

  const forceCollect = async () => {
    try {
      const res = await collectImages(allSources, disabledSources);
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
    game,
    customSources,
    defaultSources,
    disabledSources,
  };
}
