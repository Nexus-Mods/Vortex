import { useMemo } from "react";
import { useSelector } from "react-redux";

import type { IState } from "../../../../types/IState";
import type { IStarterInfo } from "../../../../util/StarterInfo";

import { makeExeId } from "../../../../reducers/session";

export interface UseToolsRunningResult {
  isRunning: boolean;
  exclusiveRunning: boolean;
}

/**
 * Hook to track the running state of tools.
 * Returns whether the primary starter is running and if any exclusive tool is running.
 */
export const useToolsRunning = (
  primaryStarter: IStarterInfo | undefined,
): UseToolsRunningResult => {
  const toolsRunning = useSelector(
    (state: IState) => state.session.base.toolsRunning,
  );

  const isRunning = useMemo(() => {
    if (!primaryStarter?.exePath) return false;
    const exeId = makeExeId(primaryStarter.exePath);
    return toolsRunning[exeId] !== undefined;
  }, [primaryStarter, toolsRunning]);

  const exclusiveRunning = useMemo(() => {
    return Object.keys(toolsRunning).some(
      (exeId) => toolsRunning[exeId].exclusive,
    );
  }, [toolsRunning]);

  return { isRunning, exclusiveRunning };
};
