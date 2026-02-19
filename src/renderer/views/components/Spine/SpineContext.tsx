import type { Action } from "redux";

import React, {
  type FC,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IMainPage } from "../../../types/IMainPage";

import { setNextProfile } from "../../../../extensions/profile_management/actions/settings";
import { setOpenMainPage } from "../../../actions/session";
import { useMainContext, usePagesContext } from "../../../contexts";
import {
  activeGameId as activeGameIdSelector,
  activeProfileId as activeProfileIdSelector,
  lastActiveProfiles as lastActiveProfilesSelector,
  mainPage as mainPageSelector,
  profileById as profileByIdSelector,
} from "../../../util/selectors";
import { batchDispatch } from "../../../util/util";

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

  const lastActiveProfile = useSelector(lastActiveProfilesSelector);
  const activeProfileId = useSelector(activeProfileIdSelector);
  const activeGameId = useSelector(activeGameIdSelector);

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

  const mainPage = useSelector(mainPageSelector);

  const defaultHomePage = homePages[0]?.id;
  const defaultGamePage = gamePages[0]?.id;

  const visiblePages = selection.type === "home" ? homePages : gamePages;

  // Track the last active page per spine context (home / per game)
  const lastPageRef = useRef<Record<string, string>>({});

  // Save the current page whenever it changes
  useEffect(() => {
    if (!mainPage) return;
    const key = selection.type === "game" ? selection.gameId : "home";
    lastPageRef.current[key] = mainPage;
  }, [mainPage, selection]);

  useEffect(() => {
    if (selection.type === "game" && defaultGamePage !== undefined) {
      dispatch(setOpenMainPage(defaultGamePage, false));
    } else if (selection.type === "home" && defaultHomePage !== undefined) {
      dispatch(setOpenMainPage(defaultHomePage, false));
    }
  }, []);

  const selectHome = useCallback(() => {
    if (defaultHomePage === undefined) return;
    const targetPage = lastPageRef.current["home"] || defaultHomePage;
    const actions: Action[] = [setOpenMainPage(targetPage, false)];
    if (activeProfileId !== undefined) {
      actions.push(setNextProfile(undefined));
    }
    batchDispatch(api.store, actions);
  }, [activeProfileId, api.store, defaultHomePage]);

  const selectGame = useCallback(
    (gameId: string) => {
      if (defaultGamePage === undefined) return;
      const targetPage = lastPageRef.current[gameId] || defaultGamePage;
      const profileId = lastActiveProfile[gameId];
      if (
        profileId !== undefined &&
        profileId !== activeProfileId &&
        profileByIdSelector(api.getState(), profileId) !== undefined
      ) {
        // Profile needs to change - wait for activation before navigating
        dispatch(setNextProfile(profileId));
        api?.events.once("profile-did-change", () => {
          dispatch(setOpenMainPage(targetPage, false));
        });
      } else {
        // Profile is already active or last profile no longer exists
        dispatch(setOpenMainPage(targetPage, false));
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
