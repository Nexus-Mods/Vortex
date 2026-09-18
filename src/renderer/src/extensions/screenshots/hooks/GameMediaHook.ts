import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector, useStore } from "react-redux";

import type { IState } from "@/types/api";

import { activeGameId, gameById, currentGameDiscovery } from "../../../util/selectors";
import * as sessionActions from "../actions/session";
import * as selectors from "../selectors";
import collectMedia, { sortMedia } from "../util/collectMedia";
import type { GameMediaItem } from "../util/mediaTypes";
import useGameMediaSources from "./GameMediaSourcesHook";
import useGameMediaWatcher from "./GameMediaWatcherHook";

const PAGE_SIZE = 24;

export default function useGameMedia(tab: string) {
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

  const onSourceChanged = useCallback((id: string) => void rescanSource(id), [rescanSource]);

  useGameMediaWatcher(allSources, disabledSources, onSourceChanged);

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

  // Pagination
  const bySource = useMemo(() => {
    const acc: Record<string, GameMediaItem[]> = {};
    for (const item of items ?? []) (acc[item.sourceId] ??= []).push(item);
    return acc;
  }, [items]);

  const [pages, setPages] = useState<Record<string, number>>({});
  const page = pages[tab] ?? 1;

  const total = tab === "all" ? (items?.length ?? 0) : (bySource[tab]?.length ?? 0);

  const pageItems = useMemo(() => {
    const source = tab === "all" ? (items ?? []) : (bySource[tab] ?? []);
    return source.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [items, bySource, tab, page]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > maxPage) setPages((p) => ({ ...p, [tab]: maxPage }));
  }, [items, bySource, tab, page, total]);

  const setPage = useCallback((next: number) => setPages((p) => ({ ...p, [tab]: next })), [tab]);

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
    bySource,
    pageItems,
    page,
    setPage,
    total,
    pageSize: PAGE_SIZE,
  };
}
