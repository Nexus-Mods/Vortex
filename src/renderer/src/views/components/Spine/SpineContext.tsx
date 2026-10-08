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

import { useMainContext, usePagesContext } from "@/contexts";
import { setNextProfile } from "@/extensions/profile_management/actions/settings";
import type { IMainPage } from "@/types/IMainPage";
import type { IState } from "@/types/IState";

import {
  setDownloadGameFilter as setDownloadGameFilterAction,
  setOpenMainPage,
} from "../../../actions/session";
import {
  activeGameId as activeGameIdSelector,
  activeProfileId as activeProfileIdSelector,
  lastActiveProfiles as lastActiveProfilesSelector,
  mainPage as mainPageSelector,
  profileById as profileByIdSelector,
} from "../../../util/selectors";
import { deriveSpineSelection, type SpineSelection } from "./spine_selection/spineSelection.util";

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

export const SpineProvider: FC<React.PropsWithChildren<unknown>> = ({
  children,
}: {
  children: ReactNode;
}) => {
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

  // Game filter for downloads mode, stored in session state
  const downloadGameFilter = useSelector(
    (state: IState) => state.session.base?.downloadGameFilter ?? null,
  );
  const setDownloadGameFilter = useCallback(
    (gameId: string | null) => dispatch(setDownloadGameFilterAction(gameId)),
    [dispatch],
  );

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
  const pageGroups = useMemo(
    () => new Map(mainPages.map((page) => [page.id, page.group])),
    [mainPages],
  );

  // Kept across renders so the util can hand back the same selection when nothing changed.
  const lastSelectionRef = useRef<SpineSelection | undefined>(undefined);
  const selection: SpineSelection = useMemo(() => {
    lastSelectionRef.current = deriveSpineSelection({
      mainPage,
      pageGroups,
      activeGameId,
      previous: lastSelectionRef.current,
    });

    return lastSelectionRef.current;
  }, [mainPage, pageGroups, activeGameId]);

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
    if (!mainPage) {
      return;
    }

    const isValidForContext = visiblePages.some((p) => p.id === mainPage);
    if (!isValidForContext) {
      return;
    }

    const key = selection.type === "game" ? selection.gameId : selection.type;
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

  // A game picked in the spine that isn't active yet, and the page it last showed,
  // taken before the switch records the current page as its own. That page opens
  // once the game is active, after the profile switch or the profile picker.
  const pendingGameRef = useRef<{ gameId: string; page?: string } | undefined>(undefined);

  useEffect(() => {
    const pending = pendingGameRef.current;
    if (activeGameId === undefined || pending?.gameId !== activeGameId) {
      return;
    }

    const targetPage = pending.page || defaultGamePage;
    if (targetPage === undefined) {
      return;
    }

    pendingGameRef.current = undefined;
    dispatch(setOpenMainPage(targetPage, false));
  }, [activeGameId, defaultGamePage, dispatch]);

  const selectHome = useCallback(() => {
    if (defaultHomePage === undefined) return;
    pendingGameRef.current = undefined;
    dispatch(setOpenMainPage(lastPageRef.current["home"] || defaultHomePage, false));
  }, [defaultHomePage, dispatch]);

  const selectDownloads = useCallback(
    (gameId?: string) => {
      pendingGameRef.current = undefined;
      setDownloadGameFilter(gameId ?? null);
      dispatch(setOpenMainPage("Downloads", false));
    },
    [dispatch, setDownloadGameFilter],
  );

  const selectGame = useCallback(
    (gameId: string) => {
      const profileId = lastActiveProfile[gameId];
      const profileExists =
        profileId !== undefined && profileByIdSelector(api.getState(), profileId) !== undefined;

      if (!profileExists) {
        // No usable last-active profile for this game — ask the
        // profile_management extension to show the profile picker dialog.
        pendingGameRef.current = { gameId, page: lastPageRef.current[gameId] };
        api?.events.emit("activate-game", gameId);
        return;
      }

      if (profileId !== activeProfileId) {
        dispatch(setNextProfile(profileId));
      }

      if (gameId !== activeGameId) {
        pendingGameRef.current = { gameId, page: lastPageRef.current[gameId] };
        return;
      }

      pendingGameRef.current = undefined;
      const targetPage = lastPageRef.current[gameId] || defaultGamePage;
      if (targetPage !== undefined) {
        dispatch(setOpenMainPage(targetPage, false));
      }
    },
    [lastActiveProfile, activeProfileId, activeGameId, dispatch, api, defaultGamePage],
  );

  const selectGlobalPage = useCallback(
    (pageId: string) => {
      pendingGameRef.current = undefined;
      dispatch(setOpenMainPage(pageId, false));
    },
    [dispatch],
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

  return <SpineContext.Provider value={value}>{children}</SpineContext.Provider>;
};

export const useSpineContext = () => {
  const context = useContext(SpineContext);

  if (context === undefined) {
    throw new Error("useSpineContext must be used within a SpineProvider");
  }

  return context;
};
