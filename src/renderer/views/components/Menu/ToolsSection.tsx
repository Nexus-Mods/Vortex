import { mdiPlay } from "@mdi/js";
import React, { useCallback, type FC } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { Button } from "../../../../tailwind/components/next/button";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { showError } from "../../../../util/message";
import { useMainContext, useWindowContext } from "../../../contexts";
import { ToolButton } from "./ToolButton";
import { type ShowErrorCallback, useTools } from "./useTools";

interface ToolsSectionProps {
  isAnimating: boolean;
}

export const ToolsSection: FC<ToolsSectionProps> = ({ isAnimating }) => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
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

  if (gameMode === undefined) {
    return null;
  }

  return (
    <div
      className={joinClasses([
        "flex flex-col items-center gap-y-1.5 rounded-md bg-surface-low py-1.5 transition-[width,padding]",
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
