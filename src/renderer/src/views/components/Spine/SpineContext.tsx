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

import {
  setDownloadGameFilter as setDownloadGameFilterAction,
  setOpenMainPage,
} from "../../../actions/session";
import { useMainContext, usePagesContext } from "../../../contexts";
import { setNextProfile } from "../../../extensions/profile_management/actions/settings";
import type { IMainPage } from "../../../types/IMainPage";
import type { IState } from "../../../types/IState";
import {
  activeGameId as activeGameIdSelector,
  activeProfileId as activeProfileIdSelector,
  lastActiveProfiles as lastActiveProfilesSelector,
  mainPage as mainPageSelector,
  profileById as profileByIdSelector,
} from "../../../util/selectors";

// gamebryo-plugin-management augments the settings slice with a `plugins`
// entry. We don't import IStateWithGamebryo from the extension to avoid a
// renderer→extension dependency, so we mirror the relevant shape locally.
interface IStateWithPlugins extends IState {
  settings: IState["settings"] & {
    plugins?: {
      pluginManagementEnabled?: { [profileId: string]: boolean };
    };
  };
}

export type SpineSelection =
  | { type: "home" }
  | { type: "game"; gameId: string }
  | { type: "downloads" };

interface ISpineContext {
  selection: SpineSelection;
  visiblePages: IMainPage[];
  /** When selection is "downloads", the game to filter by (null = all) */
  downloadGameFilter: string | null;
  selectHome: () => void;
  selectGame: (gameId: string) => void;
  selectDownloads: (gameId?: string) => void;
  setDownloadGameFilter: (gameId: string | null) => void;
  selectGlobalPage: (pageId: string) => void;
}

const SpineContext = createContext<ISpineContext | undefined>(undefined);

export const SpineProvider: FC = ({ children }: { children: ReactNode }) => {
  const { api } = useMainContext();
  const { mainPages } = usePagesContext();
  const dispatch = useDispatch();

  const profilesVisible = useSelector((state: IState) => state.settings.interface.profilesVisible);
  const lastActiveProfile = useSelector(lastActiveProfilesSelector);
  const activeProfileId = useSelector(activeProfileIdSelector);
  const activeGameId = useSelector(activeGameIdSelector);

  // APP-261: page.visible() predicates owned by extensions read state slices
  // the Spine does not natively track. Subscribe to this one so the per-game
  // page memos recompute when the user flips plugin management on/off via
  // the game-starfield "Load Order Management Method" setting (which always
  // dispatches GAMEBRYO_SET_PLUGIN_MANAGEMENT_ENABLED alongside its own
  // management-type action), otherwise the left menu stays stale until a
  // restart. Typed as `any` because this path lives in the gamebryo-plugin-
  // management extension and isn't in core IState.
  const pluginManagementEnabled = useSelector(
    (state: IStateWithPlugins) => state.settings.plugins?.pluginManagementEnabled,
  );

  // Tracks the gameId that was active when the user navigated to home.
  // When non-null and matches activeGameId, we show home pages.
  // When activeGameId changes externally (e.g., via extension or deep-link),
  // the mismatch automatically switches back to game view - no effect needed.
  const [homeForGameId, setHomeForGameId] = useState<string | null>(null);

  // When true, we're in downloads mode (overrides home/game selection)
  const [isDownloadsMode, setIsDownloadsMode] = useState(false);

  // Game filter for downloads mode, stored in session state
  const downloadGameFilter = useSelector(
    (state: IState) => state.session.base?.downloadGameFilter ?? null,
  );
  const setDownloadGameFilter = useCallback(
    (gameId: string | null) => dispatch(setDownloadGameFilterAction(gameId)),
    [dispatch],
  );

  const selection: SpineSelection = useMemo(() => {
    if (isDownloadsMode) {
      return { type: "downloads" };
    }
    if (activeGameId !== undefined && homeForGameId !== activeGameId) {
      return { type: "game", gameId: activeGameId };
    }
    return { type: "home" };
  }, [isDownloadsMode, homeForGameId, activeGameId]);

  const isPageVisible = useCallback((page: IMainPage) => {
    try {
      return page.visible();
    } catch {
      return false;
    }
  }, []);

  // activeGameId is included as dependency to re-filter when game changes
  // since page.visible() checks often depend on the active game.
  // pluginManagementEnabled is included so APP-261's stale-menu bug clears
  // when the user flips the starfield load-order management method.
  const homePages: IMainPage[] = useMemo(
    () =>
      mainPages.filter(
        (page) =>
          page.group !== "per-game" &&
          page.group !== "hidden" &&
          page.id !== "Downloads" &&
          isPageVisible(page),
      ),
    [mainPages, isPageVisible, activeGameId, profilesVisible, pluginManagementEnabled],
  );

  const gamePages: IMainPage[] = useMemo(
    () =>
      mainPages.filter(
        (page) => page.group === "per-game" && page.id !== "game-downloads" && isPageVisible(page),
      ),
    [mainPages, isPageVisible, activeGameId, profilesVisible, pluginManagementEnabled],
  );

  const mainPage = useSelector(mainPageSelector);

  const defaultHomePage = homePages[0]?.id;
  const defaultGamePage = gamePages[0]?.id;

  // Downloads mode shows a single "Downloads" page
  const downloadsPages: IMainPage[] = useMemo(
    () => mainPages.filter((page) => page.id === "Downloads" && isPageVisible(page)),
    [mainPages, isPageVisible],
  );

  const visiblePages =
    selection.type === "downloads"
      ? downloadsPages
      : selection.type === "home"
        ? homePages
        : gamePages;

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
    const currentPageValid = visiblePages.some((p) => p.id === mainPageRef.current);
    if (currentPageValid) {
      return;
    }
    if (selection.type === "downloads") {
      dispatch(setOpenMainPage("Downloads", false));
    } else if (selection.type === "game" && defaultGamePage !== undefined) {
      dispatch(setOpenMainPage(defaultGamePage, false));
    } else if (selection.type === "home" && defaultHomePage !== undefined) {
      dispatch(setOpenMainPage(defaultHomePage, false));
    }
  }, [selection, visiblePages, defaultGamePage, defaultHomePage, dispatch]);

  const selectHome = useCallback(() => {
    if (defaultHomePage === undefined) return;
    const targetPage = lastPageRef.current["home"] || defaultHomePage;
    setIsDownloadsMode(false);
    setHomeForGameId(activeGameId ?? null);
    dispatch(setOpenMainPage(targetPage, false));
  }, [activeGameId, defaultHomePage, dispatch]);

  const selectDownloads = useCallback(
    (gameId?: string) => {
      setIsDownloadsMode(true);
      setDownloadGameFilter(gameId ?? null);
      dispatch(setOpenMainPage("Downloads", false));
    },
    [dispatch],
  );

  const selectGame = useCallback(
    (gameId: string) => {
      const profileId = lastActiveProfile[gameId];
      const profileExists =
        profileId !== undefined && profileByIdSelector(api.getState(), profileId) !== undefined;

      setIsDownloadsMode(false);
      setHomeForGameId(null);

      if (!profileExists) {
        // No usable last-active profile for this game — ask the
        // profile_management extension to show the profile picker dialog.
        // Once the user picks a profile the resulting profile-did-change will
        // update activeGameId, which re-derives `selection` and the existing
        // useEffect navigates to the correct game page automatically.
        api?.events.emit("activate-game", gameId);
        return;
      }

      if (defaultGamePage === undefined) return;
      const targetPage = lastPageRef.current[gameId] || defaultGamePage;

      if (profileId !== activeProfileId) {
        // Profile needs to change - wait for activation before navigating
        dispatch(setNextProfile(profileId));
        api?.events.once("profile-did-change", () => {
          dispatch(setOpenMainPage(targetPage, false));
        });
      } else {
        // Profile is already active
        dispatch(setOpenMainPage(targetPage, false));
      }
    },
    [lastActiveProfile, activeProfileId, dispatch, api, defaultGamePage],
  );

  const selectGlobalPage = useCallback(
    (pageId: string) => {
      setHomeForGameId(activeGameId ?? null);
      dispatch(setOpenMainPage(pageId, false));
    },
    [activeGameId, dispatch],
  );

  const value = useMemo(
    () => ({
      selection,
      visiblePages,
      downloadGameFilter,
      selectHome,
      selectGame,
      selectDownloads,
      setDownloadGameFilter,
      selectGlobalPage,
    }),
    [
      selection,
      visiblePages,
      downloadGameFilter,
      selectHome,
      selectGame,
      selectDownloads,
      setDownloadGameFilter,
      selectGlobalPage,
    ],
  );

  // When show-main-page targets a per-game page, switch the Spine to game
  // context so the page becomes visible
  useEffect(() => {
    const handler = (pageId: string) => {
      if (gamePages.some((p) => p.id === pageId) && activeGameId !== undefined) {
        setHomeForGameId(null);
        setIsDownloadsMode(false);
      }
    };
    api.events.on("show-main-page", handler);
    return () => {
      api.events.removeListener("show-main-page", handler);
    };
  }, [api, gamePages, activeGameId]);

  return <SpineContext.Provider value={value}>{children}</SpineContext.Provider>;
};

export const useSpineContext = () => {
  const context = useContext(SpineContext);
  if (context === undefined) {
    throw new Error("useSpineContext must be used within a SpineProvider");
  }
  return context;
};
