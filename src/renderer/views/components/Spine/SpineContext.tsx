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

import type { IMainPage } from "../../../../types/IMainPage";
import type { IState } from "../../../../types/IState";

import { setOpenMainPage } from "../../../../actions/session";
import { setNextProfile } from "../../../../extensions/profile_management/actions/settings";
import { batchDispatch } from "../../../../util/util";
import { useMainContext, usePagesContext } from "../../../contexts";

export type SpineSelection =
  | { type: "home" }
  | { type: "game"; gameId: string };

interface ISpineContext {
  selection: SpineSelection;
  visiblePages: IMainPage[];
  selectHome: () => void;
  selectGame: (gameId: string) => void;
}

const SpineContext = createContext<ISpineContext | undefined>(undefined);

export const SpineProvider: FC = ({ children }: { children: ReactNode }) => {
  const { api } = useMainContext();
  const { mainPages } = usePagesContext();
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

  const selection: SpineSelection = useMemo(() => {
    if (activeGameId !== undefined) {
      return { type: "game", gameId: activeGameId };
    }
    return { type: "home" };
  }, [activeGameId]);

  const isPageVisible = useCallback((page: IMainPage) => {
    try {
      return page.visible();
    } catch {
      return false;
    }
  }, []);

  // activeGameId is included as dependency to re-filter when game changes
  // since page.visible() checks often depend on the active game
  const homePages = useMemo(
    () =>
      mainPages.filter(
        (page) =>
          page.group !== "per-game" &&
          page.group !== "hidden" &&
          isPageVisible(page),
      ),
    [mainPages, isPageVisible, activeGameId],
  );

  const gamePages = useMemo(
    () =>
      mainPages.filter(
        (page) => page.group === "per-game" && isPageVisible(page),
      ),
    [mainPages, isPageVisible, activeGameId],
  );

  const defaultHomePage = homePages[0]?.id;
  const defaultGamePage = gamePages[0]?.id;

  const visiblePages = selection.type === "home" ? homePages : gamePages;

  useEffect(() => {
    if (selection.type === "game" && defaultGamePage !== undefined) {
      dispatch(setOpenMainPage(defaultGamePage, false));
    }
  }, []);

  const selectHome = useCallback(() => {
    if (defaultHomePage === undefined) return;
    const actions: Action[] = [setOpenMainPage(defaultHomePage, false)];
    if (activeProfileId !== undefined) {
      actions.push(setNextProfile(undefined));
    }
    batchDispatch(api.store, actions);
  }, [activeProfileId, api.store, defaultHomePage]);

  const selectGame = useCallback(
    (gameId: string) => {
      if (defaultGamePage === undefined) return;
      const profileId = lastActiveProfile[gameId];
      if (profileId !== undefined && profileId !== activeProfileId) {
        // Profile needs to change - wait for activation before navigating
        dispatch(setNextProfile(profileId));
        api?.events.once("profile-did-change", () => {
          dispatch(setOpenMainPage(defaultGamePage, false));
        });
      } else {
        // Profile is already active
        dispatch(setOpenMainPage(defaultGamePage, false));
      }
    },
    [lastActiveProfile, activeProfileId, dispatch, api, defaultGamePage],
  );

  const value = useMemo(
    () => ({ selection, visiblePages, selectHome, selectGame }),
    [selection, visiblePages, selectHome, selectGame],
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
