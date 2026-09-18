import { useCallback, useEffect, useState } from "react";
import { useSelector, useStore } from "react-redux";

import type { IState } from "@/types/api";

import { activeGameId, gameById, currentGameDiscovery } from "../../../util/selectors";
import * as sessionActions from "../actions/session";
import * as selectors from "../selectors";
import collectMedia, { sortMedia } from "../util/collectMedia";
import type { GameMediaItem } from "../util/mediaTypes";
import useGameMediaSources from "./GameMediaSourcesHook";
import useGameMediaWatcher from "./GameMediaWatcherHook";

export default function useGameMedia() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const store = useStore();

  const gameId = useSelector(activeGameId);
  const game = useSelector((state: IState) => gameById(state, gameId));

  const discovery = useSelector(currentGameDiscovery);

  const { allSources, defaultSources, customSources, disabledSources } = useGameMediaSources();

  const items = useSelector(selectors.sessionItems);

  const setItems = useCallback(
    (i: GameMediaItem[]) => {
      store.dispatch(sessionActions.setFoundGameMedia(i));
    },
    [store],
  );

  const rescanSource = useCallback(
    async (sourceId: string) => {
      const source = allSources[sourceId];
      if (!source) return;
      const found = await collectMedia({ [sourceId]: source }, []);
      setItems([...(items ?? []).filter((i) => i.sourceId !== sourceId), ...found].sort(sortMedia));
    },
    [allSources, items, setItems],
  );

  useGameMediaWatcher(allSources, disabledSources, (id: string) => {
    void rescanSource(id);
  });

  useEffect(() => {
    if (!gameId || !discovery) return;
    let active = true;

    setIsLoading(true);
    setIsError(false);

    void (async () => {
      try {
        const found = await collectMedia(allSources, disabledSources);
        if (active) setItems(found);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e : new Error("Unknown error"));
        setIsError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [allSources, disabledSources, setItems, discovery, gameId]);

  const forceCollect = async () => {
    try {
      setIsError(false);
      setIsLoading(true);
      const res = await collectMedia(allSources, disabledSources);
      setItems(res);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(`Unknown error`));
      setIsError(true);
    } finally {
      setIsLoading(false);
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
