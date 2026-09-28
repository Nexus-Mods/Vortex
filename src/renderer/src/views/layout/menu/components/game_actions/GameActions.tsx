import { Transition } from "@headlessui/react";
import React from "react";

import { useWindowContext } from "@/contexts";
import { joinClasses } from "@/ui/utils/joinClasses";
import { useSpineContext } from "@/views/components/Spine/SpineContext";

import { useToolsContext } from "../../context/ToolsContext";
import { PlayButton } from "../play_button/PlayButton";
import { ToolButton } from "../ToolButton";

export const GameActions = () => {
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

      <PlayButton
        disabled={exclusiveRunning || isPrimaryRunning || !primaryStarter}
        gameName={gameName}
        isCollapsed={menuIsCollapsed}
        isPrimaryRunning={isPrimaryRunning}
        primaryStarter={primaryToolId ? primaryStarter : undefined}
        onClick={handlePlay}
      />
    </div>
  );
};
