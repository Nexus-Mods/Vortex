import React, { createContext, useCallback, useContext, useMemo, type FC, type ReactNode } from "react";
import { useDispatch } from "react-redux";

import { showError } from "../../../../util/message";
import { useMainContext } from "../../../contexts";
import { type ShowErrorCallback, useTools } from "./useTools";

interface MenuContextValue {
  toolCount: number;
  gameMode: string | undefined;
  visibleTools: ReturnType<typeof useTools>["visibleTools"];
  primaryStarter: ReturnType<typeof useTools>["primaryStarter"];
  primaryToolId: ReturnType<typeof useTools>["primaryToolId"];
  isRunning: boolean;
  exclusiveRunning: boolean;
  startTool: ReturnType<typeof useTools>["startTool"];
  handlePlay: ReturnType<typeof useTools>["handlePlay"];
}

const MenuContext = createContext<MenuContextValue | undefined>(undefined);

export const useMenuContext = () => {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("useMenuContext must be used within MenuProvider");
  }
  return context;
};

interface MenuProviderProps {
  children: ReactNode;
}

export const MenuProvider: FC<MenuProviderProps> = ({ children }) => {
  const { api } = useMainContext();
  const dispatch = useDispatch();

  const onShowError: ShowErrorCallback = useCallback(
    (message, details, allowReport) => {
      showError(dispatch, message, details, { allowReport });
    },
    [dispatch],
  );

  const {
    gameMode,
    visibleTools,
    primaryStarter,
    primaryToolId,
    isRunning,
    exclusiveRunning,
    startTool,
    handlePlay,
  } = useTools(onShowError, api);

  const toolCount = useMemo(() => visibleTools.length, [visibleTools.length]);

  const value = useMemo(
    () => ({
      toolCount,
      gameMode,
      visibleTools,
      primaryStarter,
      primaryToolId,
      isRunning,
      exclusiveRunning,
      startTool,
      handlePlay,
    }),
    [
      toolCount,
      gameMode,
      visibleTools,
      primaryStarter,
      primaryToolId,
      isRunning,
      exclusiveRunning,
      startTool,
      handlePlay,
    ],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
};
