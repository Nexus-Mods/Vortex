import { useMemo } from "react";
import { useSelector } from "react-redux";

import { hasExclusiveToolRunning, isExeRunning } from "../../../reducers/session";
import type { IState } from "../../../types/IState";

export interface UseToolsRunningResult {
  exclusiveRunning: boolean;
  isToolRunning: (toolExePath: string) => boolean;
}

/**
 * Hook to track the running state of tools.
 * Returns whether any exclusive tool is running and a function to check specific tools.
 */
export const useToolsRunning = (): UseToolsRunningResult => {
  const toolsRunning = useSelector((state: IState) => state.session.base.toolsRunning);

  const exclusiveRunning = useMemo(() => hasExclusiveToolRunning(toolsRunning), [toolsRunning]);

  const isToolRunning = useMemo(
    () => (toolExePath: string) => isExeRunning(toolsRunning, toolExePath),
    [toolsRunning],
  );

  return { exclusiveRunning, isToolRunning };
};
