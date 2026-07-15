import { useEffect, useReducer } from "react";
import { useSelector } from "react-redux";

import type { IState } from "../types/IState";
import type { TFunction } from "./i18n";
import { userFriendlyTime } from "./relativeTime";

const AGE_INTERVAL_MS = 30_000;

/**
 * Formats a timestamp via userFriendlyTime and re-renders the consuming
 * component periodically so a relative label ("3 minutes ago") ages on
 * screen. Keep the consumer a leaf component: the tick re-renders whatever
 * subscribes here. Returns undefined (and runs no interval) while the
 * timestamp is undefined.
 */
export function useRelativeTime(timestamp: number | undefined, t: TFunction): string | undefined {
  const language = useSelector((state: IState) => state.settings.interface.language);
  const [, ageTick] = useReducer((tick: number) => tick + 1, 0);

  const hasTimestamp = timestamp !== undefined;
  useEffect(() => {
    if (!hasTimestamp) {
      return undefined;
    }
    const id = setInterval(ageTick, AGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasTimestamp]);

  return hasTimestamp ? userFriendlyTime(new Date(timestamp), t, language) : undefined;
}
