import type { VortexGameId } from "@vortex/shared";
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
import { setLastPage } from "@/extensions/settings_interface/actions/interface";
import { lastPages as lastPagesSelector } from "@/extensions/settings_interface/selectors";
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
  nextProfileId as nextProfileIdSelector,
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

/** How a game is opened, by a pick in the spine or an "open-game" event. */
export interface ISelectGameOptions {
  /**
   * The page to open, in place of the one the game was last on. The game's first page
   * opens where it has no such page.
   */
  page?: string;
}

interface ISpineContext {
  selection: SpineSelection;
  visiblePages: IMainPage[];
  /** When selection is "downloads", the game to filter by (null = all) */
  downloadGameFilter: string | null;
  selectHome: () => void;
  selectGame: (gameId: VortexGameId, options?: ISelectGameOptions) => void;
  selectDownloads: (gameId?: string) => void;
  setDownloadGameFilter: (gameId: string | null) => void;
  selectGlobalPage: (pageId: string) => void;
}

const SpineContext = createContext<ISpineContext | undefined>(undefined);

/** The page last open in a game, or on Home when no game is given. */
const storedPage = (state: IState, gameId?: VortexGameId): string | undefined => {
  const pages = lastPagesSelector(state);
  return gameId === undefined ? pages?.home : pages?.games?.[gameId];
};

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

  // Remembered pages persist in settings.interface.lastPages. Read them from the store, don't
  // subscribe: a save on every navigation would re-run the effect below and kick the user off a
  // hidden page like collection-view. The api goes through a ref for the same reason.
  const apiRef = useRef(api);
  apiRef.current = api;
  const rememberedPage = useCallback(
    (pages: IMainPage[], gameId?: VortexGameId): string | undefined => {
      const page = storedPage(apiRef.current.getState(), gameId);
      // Skip a page that's gone or hidden.
      return pages.some((p) => p.id === page) ? page : undefined;
    },
    [],
  );

  // A game picked in the spine that isn't active yet, and the page it last showed,
  // taken before the switch records the current page as its own. That page opens
  // once the game is active, after the profile switch or the profile picker.
  const pendingGameRef = useRef<{ gameId: VortexGameId; page?: string } | undefined>(undefined);

  // A page opened because nothing remembered could be shown. Not saved, or a page that becomes
  // visible after startup would lose its place for good.
  const fallbackPageRef = useRef<string | undefined>(undefined);
  const openPage = useCallback(
    (pageId: string, fallback: boolean) => {
      fallbackPageRef.current = fallback ? pageId : undefined;
      dispatch(setOpenMainPage(pageId, false));
    },
    [dispatch],
  );

  // Save the current page whenever it changes, but only if it's
  // a valid page for the current context (avoid saving e.g. "Games"
  // global page as a game's last page)
  useEffect(() => {
    if (!mainPage || selection.type === "downloads") {
      return;
    }

    if (mainPage === fallbackPageRef.current) {
      return;
    }
    fallbackPageRef.current = undefined;

    // The picked game is active but its page isn't open yet; what's showing is the old game's.
    if (pendingGameRef.current?.gameId === activeGameId) {
      return;
    }

    const isValidForContext = visiblePages.some((p) => p.id === mainPage);
    if (!isValidForContext) {
      return;
    }

    // A game selection is always the active game.
    const gameId = selection.type === "game" ? activeGameId : undefined;
    if (storedPage(api.getState(), gameId) !== mainPage) {
      dispatch(setLastPage({ pageId: mainPage, gameId }));
    }
  }, [mainPage, selection, visiblePages, activeGameId, api, dispatch]);

  // When the spine selection changes (home↔game or between games), ensure
  // we're on a valid page for the new context. Uses a ref for mainPage so the
  // effect only fires on selection change, not on every page navigation.
  //
  // This also restores the remembered page at startup. That relies on the session starting on
  // "Games" (not a game page) and the active game being known on the first render.
  const mainPageRef = useRef(mainPage);
  mainPageRef.current = mainPage;

  useEffect(() => {
    const currentPageValid = visiblePages.some((p) => p.id === mainPageRef.current);
    if (currentPageValid) {
      return;
    }

    if (selection.type === "downloads") {
      dispatch(setOpenMainPage("Downloads", false));
      return;
    }

    const remembered = rememberedPage(
      visiblePages,
      selection.type === "game" ? activeGameId : undefined,
    );
    const fallback = selection.type === "game" ? defaultGamePage : defaultHomePage;
    if (remembered !== undefined) {
      openPage(remembered, false);
    } else if (fallback !== undefined) {
      openPage(fallback, true);
    }
  }, [
    selection,
    visiblePages,
    activeGameId,
    rememberedPage,
    defaultGamePage,
    defaultHomePage,
    dispatch,
    openPage,
  ]);

  useEffect(() => {
    const pending = pendingGameRef.current;
    if (activeGameId === undefined || pending?.gameId !== activeGameId) {
      return;
    }

    // Check against the new game's pages.
    const remembered = gamePages.some((p) => p.id === pending.page) ? pending.page : undefined;
    if (remembered === undefined && defaultGamePage === undefined) {
      return;
    }

    pendingGameRef.current = undefined;
    openPage(remembered ?? defaultGamePage, remembered === undefined);
  }, [activeGameId, gamePages, defaultGamePage, openPage]);

  const selectHome = useCallback(() => {
    if (defaultHomePage === undefined) return;
    pendingGameRef.current = undefined;
    const remembered = rememberedPage(homePages);
    openPage(remembered ?? defaultHomePage, remembered === undefined);
  }, [homePages, rememberedPage, defaultHomePage, openPage]);

  const selectDownloads = useCallback(
    (gameId?: string) => {
      pendingGameRef.current = undefined;
      setDownloadGameFilter(gameId ?? null);
      dispatch(setOpenMainPage("Downloads", false));
    },
    [dispatch, setDownloadGameFilter],
  );

  const selectGame = useCallback(
    (gameId: VortexGameId, options?: ISelectGameOptions) => {
      const state = api.getState();
      // A page asked for wins over where the game was, which is what a game that was just
      // added wants: a page left over from managing it before isn't a place to come back
      // to. It opens as a page of the game's own, so it is remembered in that one's place.
      const page = options?.page ?? storedPage(state, gameId);

      // Whoever added the game has already started the switch to its new profile. That
      // profile was never active, so asking for one below would raise the profile picker.
      const nextProfileId = nextProfileIdSelector(state);
      const switchingToGame =
        nextProfileId !== undefined && profileByIdSelector(state, nextProfileId)?.gameId === gameId;
      if (switchingToGame && gameId !== activeGameId) {
        pendingGameRef.current = { gameId, page };
        return;
      }

      const profileId = lastActiveProfile[gameId];
      const profileExists =
        profileId !== undefined && profileByIdSelector(state, profileId) !== undefined;

      if (!profileExists) {
        // No usable last-active profile for this game — ask the
        // profile_management extension to show the profile picker dialog.
        pendingGameRef.current = { gameId, page };
        api?.events.emit("activate-game", gameId);
        return;
      }

      if (profileId !== activeProfileId) {
        dispatch(setNextProfile(profileId));
      }

      if (gameId !== activeGameId) {
        pendingGameRef.current = { gameId, page };
        return;
      }

      pendingGameRef.current = undefined;
      const remembered = gamePages.some((p) => p.id === page) ? page : undefined;
      if (remembered !== undefined || defaultGamePage !== undefined) {
        openPage(remembered ?? defaultGamePage, remembered === undefined);
      }
    },
    [
      lastActiveProfile,
      activeProfileId,
      activeGameId,
      dispatch,
      api,
      gamePages,
      defaultGamePage,
      openPage,
    ],
  );

  // Anything outside the spine that opens a game asks through this event and gets what a
  // click on the game's spine button does: the Games page's tiles, and adding a game,
  // which names the page it opens on.
  useEffect(() => {
    api.events.on("open-game", selectGame);
    return () => {
      api.events.removeListener("open-game", selectGame);
    };
  }, [api, selectGame]);

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
