import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { activeGameId, currentGameDiscovery, gameById } from "@/util/selectors";

import * as selectors from "../selectors";
import type { GameMediaSource } from "../util/mediaTypes";
import sourcesByDiscovery from "../util/sourcesByDiscovery";

export default function useGameMediaSources() {
  const gameId = useSelector(activeGameId);
  const game = useSelector((state: IState) => gameById(state, gameId));
  const discovery = useSelector(currentGameDiscovery);
  const [defaultSources, setDefaultSources] = useState<Record<string, GameMediaSource>>({});

  const customSources: Record<string, GameMediaSource> | undefined = useSelector((state: IState) =>
    selectors.customSources(state, gameId),
  );

  const disabledSources: readonly string[] = useSelector((state: IState) =>
    selectors.disabledSources(state, gameId),
  );

  const flags = useSelector(selectors.gameMediaFlags);

  const allSources: Record<string, GameMediaSource> = useMemo(
    () => ({ ...defaultSources, ...customSources }),
    [defaultSources, customSources],
  );

  useEffect(() => {
    let active = true;

    if (!gameId || !discovery) {
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setDefaultSources({});
      return;
    }

    const loadDefault = async () => {
      try {
        const res = await sourcesByDiscovery(game, discovery, flags);
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
  }, [gameId, discovery, game, flags]);

  return {
    allSources,
    defaultSources,
    customSources,
    disabledSources,
    flags,
  };
}
