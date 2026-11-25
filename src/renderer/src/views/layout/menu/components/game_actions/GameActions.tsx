import { Transition } from "@headlessui/react";
import React, { useMemo } from "react";

import { useMainContext, useWindowContext } from "@/contexts";
import { useDeployMods } from "@/extensions/mod_management/hooks/useDeployMods.hook";
import { joinClasses } from "@/ui/utils/joinClasses";
import { useSpineContext } from "@/views/components/Spine/SpineContext";

import { useToolsContext } from "../../context/ToolsContext";
import { createMenuTracker } from "../../menuTracker";
import { ApplyButton } from "../apply_button/ApplyButton";
import { PlayButton } from "../play_button/PlayButton";
import { ToolButton } from "../ToolButton";

export const GameActions = () => {
  const { api } = useMainContext();
  const { trackApplyClicked } = useMemo(() => createMenuTracker(api), [api]);
  const { menuIsCollapsed } = useWindowContext();
  const { selection } = useSpineContext();
  const {
    gameId,
    gameName,
    visibleTools,
    primaryStarter,
    primaryToolId,
    isPrimaryRunning,
    exclusiveRunning,
    isToolRunning,
    startTool,
    handlePlay,
  } = useToolsContext();
  const {
    needToDeploy,
    autoDeploy,
    isPurged,
    isDeploying,
    deployProgress,
    deployStep,
    isPurging,
    purgeProgress,
    deploy,
  } = useDeployMods();
  // With auto deploy on, changes deploy on their own, so Apply only shows its progress, or
  // after a purge, which auto deploy leaves alone. A running purge shows in Apply's place too.
  const showApply = isDeploying || isPurging || isPurged || (needToDeploy && !autoDeploy);
  // A deploy queued behind a purge can start a moment before the purge has cleared, so the
  // deploy wins when both are set.
  const showPurge = isPurging && !isDeploying;

  if (gameId === undefined || selection.type !== "game") {
    return null;
  }

  return (
    <div
      className={joinClasses([
        "absolute bottom-3 left-3 z-2 flex flex-col items-center gap-y-3 transition-[left,width]",
        menuIsCollapsed ? "w-10" : "w-49",
      ])}
    >
      {!!visibleTools.length && (
        <Transition
          appear
          show
          as="div"
          className={joinClasses([
            "flex items-center gap-1 border-b border-stroke-weak pb-3",
            menuIsCollapsed ? "w-10 flex-wrap justify-center" : "w-full flex-wrap-reverse",
          ])}
          data-testid="menu-tools"
          enter="transition-[translate,opacity] delay-150 duration-200 reduce-motion:delay-0"
          enterFrom="translate-y-6 opacity-0 reduce-motion:translate-y-0 reduce-motion:opacity-100"
          enterTo="translate-y-0 opacity-100"
          key={menuIsCollapsed ? "collapsed" : "expanded"}
        >
          {visibleTools.map((starter) => (
            <ToolButton
              isRunning={isToolRunning(starter.exePath)}
              key={starter.id}
              starter={starter}
              onClick={() => startTool(starter)}
            />
          ))}
        </Transition>
      )}

      <div className={joinClasses("flex w-full gap-3", { "flex-wrap": menuIsCollapsed })}>
        <PlayButton
          disabled={
            exclusiveRunning || isPrimaryRunning || isDeploying || isPurging || !primaryStarter
          }
          gameName={gameName}
          hideLabel={showApply}
          isCollapsed={menuIsCollapsed}
          isPrimaryRunning={isPrimaryRunning}
          isWaitingForApply={isDeploying || isPurging}
          primaryStarter={primaryToolId ? primaryStarter : undefined}
          onClick={handlePlay}
        />

        {showApply && (
          <ApplyButton
            isCollapsed={menuIsCollapsed}
            isPurging={showPurge}
            progress={showPurge ? purgeProgress : deployProgress}
            step={deployStep}
            onClick={() => {
              trackApplyClicked();
              deploy();
            }}
          />
        )}
      </div>
    </div>
  );
};
