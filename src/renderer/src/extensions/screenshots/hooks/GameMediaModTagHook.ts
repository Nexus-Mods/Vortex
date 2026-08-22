import { useCallback, useRef, useState } from "react";
import { useSelector, useStore } from "react-redux";

import type { IState } from "@/types/api";
import { getGame, nexusGameId } from "@/util/api";

import { activeGameId } from "../../../util/selectors";
import * as actions from "../actions/persistent";
import type { GameMediaModTag } from "../util/mediaTypes";
import type { IStateWithGameMedia } from "../util/types";

export default function useGameMediaModTag(mediaItemId: string) {
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);
  const store = useStore();

  const { gameId, domainName } = useSelector((state: IState) => {
    const gameId = activeGameId(state);
    const game = getGame(gameId);
    const domainName = nexusGameId(game);
    return {
      gameId,
      domainName,
    };
  });
  const tags = useSelector(
    (state: IStateWithGameMedia) => state.persistent.game_media.modTags?.[gameId]?.[mediaItemId],
  );

  const setTags = useCallback(
    (tags: GameMediaModTag[]) => {
      store.dispatch(actions.setGameMediaModTags(gameId, mediaItemId, tags));
    },
    [store, gameId, mediaItemId],
  );

  function getRelativeCoords(clickEvent: React.MouseEvent, container: HTMLElement) {
    const rect = container.getBoundingClientRect();
    const x = (clickEvent.clientX - rect.left) / rect.width;
    const y = (clickEvent.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }

  const onImageClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isAddingTag || !containerRef.current) return;
      const coords = getRelativeCoords(e, containerRef.current);
      setPendingCoords(coords);
    },
    [isAddingTag, containerRef],
  );

  return {
    isAddingTag,
    setIsAddingTag,
    containerRef,
    pendingCoords,
    setPendingCoords,
    onImageClick,
    tags,
    setTags,
    searchTerm,
    setSearchTerm,
    domainName,
    gameId,
  };
}
