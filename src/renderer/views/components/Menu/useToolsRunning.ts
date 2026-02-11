import { useMemo } from "react";
import { useSelector } from "react-redux";

import type { IState } from "../../../../types/IState";

import { makeExeId } from "../../../../reducers/session";

export interface UseToolsRunningResult {
  exclusiveRunning: boolean;
  isToolRunning: (toolExePath: string) => boolean;
}

/**
 * Hook to track the running state of tools.
 * Returns whether any exclusive tool is running and a function to check specific tools.
 */
export const useToolsRunning = (): UseToolsRunningResult => {
  const toolsRunning = useSelector(
    (state: IState) => state.session.base.toolsRunning,
  );

  const exclusiveRunning = useMemo(() => {
    return Object.keys(toolsRunning).some(
      (exeId) => toolsRunning[exeId].exclusive,
    );
  }, [toolsRunning]);

  const isToolRunning = useMemo(() => {
    return (toolExePath: string): boolean => {
      if (!toolExePath) return false;
      const exeId = makeExeId(toolExePath);
      return toolsRunning[exeId] !== undefined;
    };
  }, [toolsRunning]);

  return { exclusiveRunning, isToolRunning };
};
