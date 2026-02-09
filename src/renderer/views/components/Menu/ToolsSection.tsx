import { mdiPlay } from "@mdi/js";
import React, { type FC } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../../../tailwind/components/next/button";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { useWindowContext } from "../../../contexts";
import { useMenuContext } from "./MenuContext";
import { ToolButton } from "./ToolButton";

interface ToolsSectionProps {
  isAnimating: boolean;
}

export const ToolsSection: FC<ToolsSectionProps> = ({ isAnimating }) => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const {
    gameMode,
    visibleTools,
    primaryStarter,
    primaryToolId,
    isRunning,
    exclusiveRunning,
    startTool,
    handlePlay,
  } = useMenuContext();

  if (gameMode === undefined) {
    return null;
  }

  return (
    <div
      className={joinClasses([
        "absolute bottom-3 left-3 flex flex-col items-center gap-y-1.5 rounded-md bg-surface-low py-1.5 shadow-lg transition-[width,padding]",
        menuIsCollapsed ? "w-10 px-0.5" : "w-50 px-1.5",
      ])}
    >
      <div
        className={joinClasses([
          "flex flex-wrap items-center gap-1.5 transition-[translate,opacity]",
          menuIsCollapsed ? "w-8" : "w-46",
          isAnimating ? "translate-y-6 opacity-0 duration-0" : "duration-200",
        ])}
      >
        {visibleTools.map((starter) => (
          <ToolButton
            isPrimary={
              primaryToolId ? starter.id === primaryToolId : starter.isGame
            }
            key={starter.id}
            starter={starter}
            onClick={() => startTool(starter)}
          />
        ))}
      </div>

      <Button
        buttonType="secondary"
        className="w-full transition-all"
        disabled={exclusiveRunning || isRunning || !primaryStarter}
        filled="strong"
        leftIconPath={mdiPlay}
        onClick={handlePlay}
      >
        {!menuIsCollapsed
          ? isRunning
            ? t("Running...")
            : t("Play")
          : undefined}
      </Button>
    </div>
  );
};
