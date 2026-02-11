import React, {
  createContext,
  useCallback,
  useContext,
  type FC,
  type ReactNode,
} from "react";
import { useDispatch } from "react-redux";

import { showError } from "../../../../util/message";
import { useMainContext } from "../../../contexts";
import { type ShowErrorCallback, useTools } from "./useTools";

type IToolsContext = ReturnType<typeof useTools>;

const ToolsContext = createContext<IToolsContext | undefined>(undefined);

export const useToolsContext = () => {
  const context = useContext(ToolsContext);
  if (!context) {
    throw new Error("useToolsContext must be used within ToolsProvider");
  }
  return context;
};

interface ToolsProviderProps {
  children: ReactNode;
}

export const ToolsProvider: FC<ToolsProviderProps> = ({ children }) => {
  const { api } = useMainContext();
  const dispatch = useDispatch();

  const onShowError: ShowErrorCallback = useCallback(
    (message, details, allowReport) => {
      showError(dispatch, message, details, { allowReport });
    },
    [dispatch],
  );

  const value = useTools(onShowError, api);

  return (
    <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>
  );
};
