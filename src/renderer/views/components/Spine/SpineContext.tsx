import React, {
  type FC,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IMainPage } from "../../../types/IMainPage";

import { setOpenMainPage } from "../../../actions/session";
import { useMainContext, usePagesContext } from "../../../contexts";
import { setNextProfile } from "../../../extensions/profile_management/actions/settings";
import {
  activeGameId as activeGameIdSelector,
  activeProfileId as activeProfileIdSelector,
  lastActiveProfiles as lastActiveProfilesSelector,
  mainPage as mainPageSelector,
  profileById as profileByIdSelector,
} from "../../../util/selectors";
type SpineSelectionType = "home" | "game";

export type SpineSelection =
  | { type: "home" }
  | { type: "game"; gameId: string };

interface ISpineContext {
  selection: SpineSelection;
  visiblePages: IMainPage[];
  selectHome: () => void;
  selectGame: (gameId: string) => void;
  selectGlobalPage: (pageId: string) => void;
}

const SpineContext = createContext<ISpineContext | undefined>(undefined);

export const SpineProvider: FC = ({ children }: { children: ReactNode }) => {
  const { api } = useMainContext();
  const { mainPages } = usePagesContext();
  const dispatch = useDispatch();

  const lastActiveProfile = useSelector(lastActiveProfilesSelector);
  const activeProfileId = useSelector(activeProfileIdSelector);
  const activeGameId = useSelector(activeGameIdSelector);

  // Selection is independent UI state — it does NOT drive profile changes.
  // The profile/gamemode remains active even when viewing home pages.
  const [selectionType, setSelectionType] = useState<SpineSelectionType>(
    activeGameId !== undefined ? "game" : "home",
  );

  const selection: SpineSelection = useMemo(() => {
    if (selectionType === "game" && activeGameId !== undefined) {
      return { type: "game", gameId: activeGameId };
    }
    return { type: "home" };
  }, [selectionType, activeGameId]);

  const isPageVisible = useCallback((page: IMainPage) => {
    try {
      return page.visible();
    } catch {
      return false;
    }
  }, []);

  // activeGameId is included as dependency to re-filter when game changes
  // since page.visible() checks often depend on the active game
  const homePages: IMainPage[] = useMemo(
    () =>
      mainPages.filter(
        (page) =>
          page.group !== "per-game" &&
          page.group !== "hidden" &&
          isPageVisible(page),
      ),
    [mainPages, isPageVisible, activeGameId],
  );

  const gamePages: IMainPage[] = useMemo(
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

  // Save the current page whenever it changes, but only if it's
  // a valid page for the current context (avoid saving e.g. "Games"
  // global page as a game's last page)
  useEffect(() => {
    if (!mainPage) return;
    const isValidForContext = visiblePages.some((p) => p.id === mainPage);
    if (!isValidForContext) return;
    const key = selection.type === "game" ? selection.gameId : "home";
    lastPageRef.current[key] = mainPage;
  }, [mainPage, selection, visiblePages]);

  // When the spine selection changes (home↔game or between games), ensure
  // we're on a valid page for the new context. Uses a ref for mainPage so the
  // effect only fires on selection change, not on every page navigation.
  const mainPageRef = useRef(mainPage);
  mainPageRef.current = mainPage;

  useEffect(() => {
    const currentPageValid = visiblePages.some(
      (p) => p.id === mainPageRef.current,
    );
    if (currentPageValid) {
      return;
    }
    if (selection.type === "game" && defaultGamePage !== undefined) {
      dispatch(setOpenMainPage(defaultGamePage, false));
    } else if (selection.type === "home" && defaultHomePage !== undefined) {
      dispatch(setOpenMainPage(defaultHomePage, false));
    }
  }, [selection, visiblePages, defaultGamePage, defaultHomePage, dispatch]);

  const selectHome = useCallback(() => {
    if (defaultHomePage === undefined) return;
    const targetPage = lastPageRef.current["home"] || defaultHomePage;
    setSelectionType("home");
    dispatch(setOpenMainPage(targetPage, false));
  }, [defaultHomePage, dispatch]);

  const selectGame = useCallback(
    (gameId: string) => {
      if (defaultGamePage === undefined) return;
      const targetPage = lastPageRef.current[gameId] || defaultGamePage;
      const profileId = lastActiveProfile[gameId];
      setSelectionType("game");
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

  const selectGlobalPage = useCallback(
    (pageId: string) => {
      setSelectionType("home");
      dispatch(setOpenMainPage(pageId, false));
    },
    [dispatch],
  );

  const value = useMemo(
    () => ({ selection, visiblePages, selectHome, selectGame, selectGlobalPage }),
    [selection, visiblePages, selectHome, selectGame, selectGlobalPage],
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
