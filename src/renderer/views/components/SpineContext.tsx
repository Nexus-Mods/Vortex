import type { Action } from "redux";

import React, {
  type FC,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../../types/IState";

import { setOpenMainPage } from "../../../actions/session";
import { setNextProfile } from "../../../extensions/profile_management/actions/settings";
import { batchDispatch } from "../../../util/util";
import { useMainContext } from "../../contexts";

// Default pages for each selection type
const DEFAULT_HOME_PAGE = "Dashboard";
const DEFAULT_GAME_PAGE = "Mods";

export type SpineSelection =
  | { type: "home" }
  | { type: "game"; gameId: string };

interface ISpineContext {
  selection: SpineSelection;
  selectHome: () => void;
  selectGame: (gameId: string) => void;
}

const SpineContext = createContext<ISpineContext | undefined>(undefined);

export const SpineProvider: FC = ({ children }: { children: ReactNode }) => {
  const { api } = useMainContext();
  const dispatch = useDispatch();

  const lastActiveProfile = useSelector(
    (state: IState) => state.settings.profiles.lastActiveProfile,
  );
  const activeProfileId = useSelector(
    (state: IState) => state.settings.profiles.activeProfileId,
  );
  const activeGameId = useSelector((state: IState) => {
    if (activeProfileId === undefined) return undefined;
    return state.persistent.profiles[activeProfileId]?.gameId;
  });

  // Derive selection from Redux state
  const selection: SpineSelection = useMemo(() => {
    if (activeGameId !== undefined) {
      return { type: "game", gameId: activeGameId };
    }
    return { type: "home" };
  }, [activeGameId]);

  // Navigate to the correct page on mount based on initial selection
  // Only runs once on mount - intentionally using initial selection value
  useEffect(() => {
    if (selection.type === "game") {
      dispatch(setOpenMainPage(DEFAULT_GAME_PAGE, false));
    }
  }, []);

  const selectHome = useCallback(() => {
    const actions: Action[] = [setOpenMainPage(DEFAULT_HOME_PAGE, false)];
    if (activeProfileId !== undefined) {
      actions.push(setNextProfile(undefined));
    }
    batchDispatch(api.store, actions);
  }, [activeProfileId, api.store]);

  const selectGame = useCallback(
    (gameId: string) => {
      const profileId = lastActiveProfile[gameId];
      if (profileId !== undefined && profileId !== activeProfileId) {
        // Profile needs to change - wait for activation before navigating
        dispatch(setNextProfile(profileId));
        api?.events.once("profile-did-change", () => {
          dispatch(setOpenMainPage(DEFAULT_GAME_PAGE, false));
        });
      } else {
        // Profile is already active
        dispatch(setOpenMainPage(DEFAULT_GAME_PAGE, false));
      }
    },
    [lastActiveProfile, activeProfileId, dispatch, api],
  );

  const value = useMemo(
    () => ({ selection, selectHome, selectGame }),
    [selection, selectHome, selectGame],
  );

  return (
    <SpineContext.Provider value={value}>{children}</SpineContext.Provider>
  );
};

export const useSpineContext = () => {
  const context = useContext(SpineContext);
  if (context === undefined) {
    throw new Error("useSpineContext must be used within a SpineProvider");
  }
  return context;
};
