import { useCallback, useState } from "react";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";

import { activeProfile } from "../../../profile_management/selectors";
import type { IModWithState } from "../../types/IModProps";

const profileModState = (state: IState) => activeProfile(state)?.modState;

/**
 * Enables and disables mods from the table's switches, which show each change at once,
 * busy, until it lands or fails: extensions get a say before a mod's state changes, which
 * can take a while.
 */
export const useModsEnabled = (
  onSetModsEnabled: (modIds: string[], enabled: boolean) => void | PromiseLike<unknown>,
) => {
  const [changing, setChanging] = useState<ReadonlyMap<string, boolean>>(() => new Map());

  const setEnabled = useCallback(
    (ids: string[], enabled: boolean) => {
      if (ids.length === 0) {
        return;
      }

      setChanging((previous) => new Map([...previous, ...ids.map((id) => [id, enabled] as const)]));

      const settle = () =>
        setChanging((previous) => {
          const next = new Map(previous);
          ids.filter((id) => next.get(id) === enabled).forEach((id) => next.delete(id));
          return next;
        });

      Promise.resolve(onSetModsEnabled(ids, enabled)).then(settle, settle);
    },
    [onSetModsEnabled],
  );

  // From the profile, which a switch changes at once; the mods catch up only once ModList,
  // after its debounce, rebuilds them.
  const modState = useSelector(profileModState);
  const isEnabled = useCallback(
    (mod: IModWithState) => changing.get(mod.id) ?? modState?.[mod.id]?.enabled ?? !!mod.enabled,
    [changing, modState],
  );

  return { changing, setEnabled, isEnabled };
};
