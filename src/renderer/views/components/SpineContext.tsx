import React from "react";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage } from "../../../actions/session";
import { setNextProfile } from "../../../extensions/profile_management/actions/settings";
import type { IState } from "../../../types/IState";
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

const SpineContext = React.createContext<ISpineContext | undefined>(undefined);

export const SpineProvider = ({ children }: { children: React.ReactNode }) => {
  const [selection, setSelection] = React.useState<SpineSelection>({
    type: "home",
  });
  const { api } = React.useContext(MainContext);
  const dispatch = useDispatch();
  const lastActiveProfile = useSelector(
    (state: IState) => state.settings.profiles.lastActiveProfile,
  );

  const selectHome = React.useCallback(() => {
    setSelection({ type: "home" });
    dispatch(setOpenMainPage(DEFAULT_HOME_PAGE, false));
  }, [dispatch]);

  const activeProfileId = useSelector(
    (state: IState) => state.settings.profiles.activeProfileId,
  );

  const selectGame = React.useCallback(
    (gameId: string) => {
      setSelection({ type: "game", gameId });
      // Activate the game's last active profile
      const profileId = lastActiveProfile[gameId];
      if (profileId !== undefined && profileId !== activeProfileId) {
        // Profile needs to change - wait for it
        dispatch(setNextProfile(profileId));
        api?.events.once("profile-did-change", () => {
          dispatch(setOpenMainPage(DEFAULT_GAME_PAGE, false));
        });
      } else {
        // Profile is already active or no profile needed
        dispatch(setOpenMainPage(DEFAULT_GAME_PAGE, false));
      }
    },
    [lastActiveProfile, activeProfileId, dispatch, api],
  );

  const selectGameAsync = React.useCallback(
    async (gameId: string): Promise<void> => {
      setSelection({ type: "game", gameId });
      // Activate the game's last active profile
      const profileId = lastActiveProfile[gameId];
      if (profileId !== undefined && profileId !== activeProfileId) {
        // Profile needs to change - wait for it
        dispatch(setNextProfile(profileId));
        await new Promise<void>((resolve) => {
          api?.events.once("profile-did-change", () => resolve());
        });
      }
      dispatch(setOpenMainPage(DEFAULT_GAME_PAGE, false));
    },
    [lastActiveProfile, activeProfileId, dispatch, api],
  );

  const value = React.useMemo(
    () => ({ selection, selectHome, selectGame, selectGameAsync }),
    [selection, selectHome, selectGame, selectGameAsync],
  );

  return (
    <SpineContext.Provider value={value}>{children}</SpineContext.Provider>
  );
};

export const useSpineContext = () => {
  const context = React.useContext(SpineContext);
  if (context === undefined) {
    throw new Error("useSpineContext must be used within a SpineProvider");
  }
  return context;
};
