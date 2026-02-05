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

import type { IMainPage } from "../../../types/IMainPage";
import type { IState } from "../../../types/IState";

import { setOpenMainPage } from "../../../actions/session";
import { setNextProfile } from "../../../extensions/profile_management/actions/settings";
import { batchDispatch } from "../../../util/util";
import { useMainContext, usePagesContext } from "../../contexts";

export type SpineSelection =
  | { type: "home" }
  | { type: "profile"; profileId: string };

interface ISpineContext {
  selection: SpineSelection;
  visiblePages: IMainPage[];
  selectHome: () => void;
  selectProfile: (profileId: string) => void;
}

const SpineContext = createContext<ISpineContext | undefined>(undefined);

export const SpineProvider: FC = ({ children }: { children: ReactNode }) => {
  const { api } = useMainContext();
  const { mainPages } = usePagesContext();
  const dispatch = useDispatch();

  const activeProfileId = useSelector(
    (state: IState) => state.settings.profiles.activeProfileId,
  );

  const selection: SpineSelection = useMemo(() => {
    if (activeProfileId !== undefined) {
      return { type: "profile", profileId: activeProfileId };
    }
    return { type: "home" };
  }, [activeProfileId]);

  const isPageVisible = useCallback((page: IMainPage) => {
    try {
      return page.visible();
    } catch {
      return false;
    }
  }, []);

  // activeProfileId is included as dependency to re-filter when profile changes
  // since page.visible() checks often depend on the active profile
  const homePages = useMemo(
    () =>
      mainPages.filter(
        (page) =>
          page.group !== "per-game" &&
          page.group !== "hidden" &&
          isPageVisible(page),
      ),
    [mainPages, isPageVisible, activeProfileId],
  );

  const gamePages = useMemo(
    () =>
      mainPages.filter(
        (page) => page.group === "per-game" && isPageVisible(page),
      ),
    [mainPages, isPageVisible, activeProfileId],
  );

  const defaultHomePage = homePages[0]?.id;
  const defaultGamePage = gamePages[0]?.id;

  const visiblePages = selection.type === "home" ? homePages : gamePages;

  useEffect(() => {
    if (selection.type === "profile" && defaultGamePage !== undefined) {
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

  const selectProfile = useCallback(
    (profileId: string) => {
      if (defaultGamePage === undefined) return;
      if (profileId !== activeProfileId) {
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
    [activeProfileId, dispatch, api, defaultGamePage],
  );

  const value = useMemo(
    () => ({ selection, visiblePages, selectHome, selectProfile }),
    [selection, visiblePages, selectHome, selectProfile],
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
