import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../../types/IState";

import { setOpenMainPage } from "../../../actions/session";
import { setNextProfile } from "../../../extensions/profile_management/actions/settings";
import { MainContext } from "../MainWindow";

// Default pages for each selection type
// Note: Page IDs are typically the title (capitalized) unless an explicit id is provided
const DEFAULT_HOME_PAGE = "Dashboard";
const DEFAULT_GAME_PAGE = "Mods";

export type SpineSelection =
  | { type: "home" }
  | { type: "game"; gameId: string };

interface ISpineContext {
  selection: SpineSelection;
  selectHome: () => void;
  selectGame: (gameId: string) => void;
  selectGameAsync: (gameId: string) => Promise<void>;
}

const SpineContext = createContext<ISpineContext | undefined>(undefined);

export const SpineProvider = ({ children }: { children: ReactNode }) => {
  const { api } = useContext(MainContext);
  const dispatch = useDispatch();

  const profiles = useSelector((state: IState) => state.persistent.profiles);
  const lastActiveProfile = useSelector(
    (state: IState) => state.settings.profiles.lastActiveProfile,
  );
  const activeProfileId = useSelector(
    (state: IState) => state.settings.profiles.activeProfileId,
  );

  // Derive selection from active profile - this automatically syncs with any profile changes
  const selection = useMemo<SpineSelection>(() => {
    if (activeProfileId === undefined) {
      return { type: "home" };
    }
    const profile = profiles[activeProfileId];
    if (profile?.gameId !== undefined) {
      return { type: "game", gameId: profile.gameId };
    }
    return { type: "home" };
  }, [activeProfileId, profiles]);

  const selectHome = useCallback(() => {
    // Navigate to Dashboard first to hide game-specific pages before deactivating profile
    dispatch(setOpenMainPage(DEFAULT_HOME_PAGE, false));
    // Then deactivate any active profile
    if (activeProfileId !== undefined) {
      dispatch(setNextProfile(undefined));
    }
  }, [activeProfileId, dispatch]);

  const selectGame = useCallback(
    (gameId: string) => {
      // Always navigate to Mods first to hide any game-specific pages before switching profiles
      dispatch(setOpenMainPage(DEFAULT_GAME_PAGE, false));

      // Activate the game's last active profile
      const profileId = lastActiveProfile[gameId];
      if (profileId !== undefined && profileId !== activeProfileId) {
        // Profile needs to change
        dispatch(setNextProfile(profileId));
      }
      // Selection will automatically update when profile state changes
    },
    [lastActiveProfile, activeProfileId, dispatch],
  );

  const selectGameAsync = useCallback(
    async (gameId: string): Promise<void> => {
      // Always navigate to Mods first to hide any game-specific pages before switching profiles
      dispatch(setOpenMainPage(DEFAULT_GAME_PAGE, false));

      // Activate the game's last active profile
      const profileId = lastActiveProfile[gameId];
      if (profileId !== undefined && profileId !== activeProfileId) {
        // Profile needs to change - wait for activation
        dispatch(setNextProfile(profileId));
        await new Promise<void>((resolve) => {
          api?.events.once("profile-did-change", () => resolve());
        });
      }
      // Selection will automatically update when profile state changes
    },
    [lastActiveProfile, activeProfileId, dispatch, api],
  );

  const value = useMemo(
    () => ({ selection, selectHome, selectGame, selectGameAsync }),
    [selection, selectHome, selectGame, selectGameAsync],
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
