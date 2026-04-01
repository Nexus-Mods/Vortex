import { mdiPlay } from "@mdi/js";
import React, { type FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { pathToFileURL } from "url";

import type { IStarterInfo } from "../../../util/StarterInfo";

import { useWindowContext } from "../../../contexts";
import { Button } from "../../../ui/components/button/Button";
import { joinClasses } from "../../../ui/utils/joinClasses";
import StarterInfo from "../../../util/StarterInfo";
import { useSpineContext } from "../Spine/SpineContext";
import { ToolButton } from "./ToolButton";
import { useToolsContext } from "./ToolsContext";

interface PlayButtonProps {
  primaryStarter: IStarterInfo | undefined;
  isPrimaryRunning: boolean;
  isCollapsed: boolean;
  disabled: boolean;
  onClick: () => void;
}

const PlayButton: FC<PlayButtonProps> = ({
  primaryStarter,
  isPrimaryRunning,
  isCollapsed,
  disabled,
  onClick,
}) => {
  const { t } = useTranslation();

  const launcherIconSrc = useMemo(() => {
    if (!primaryStarter || isCollapsed) return undefined;
    try {
      const iconPath = StarterInfo.getIconPath(primaryStarter);
      if (iconPath) {
        return pathToFileURL(iconPath).href.replace("'", "%27");
      }
    } catch {
      // ignore
    }
    return undefined;
  }, [primaryStarter, isCollapsed]);

  const label = !isCollapsed
    ? isPrimaryRunning
      ? t("Running...")
      : t("Play")
    : undefined;

  return (
    <div className="relative w-full">
      <Button
        buttonType="secondary"
        className="w-full transition-all"
        disabled={disabled}
        filled="strong"
        leftIconPath={mdiPlay}
        onClick={onClick}
      >
        {label}
      </Button>

      {launcherIconSrc && (
        <div className="pointer-events-none absolute inset-0 z-2 flex items-center p-1">
          <img
            alt=""
            className="size-7 rounded-xs object-cover"
            src={launcherIconSrc}
          />
        </div>
      )}
    </div>
  );
};

interface ToolsSectionProps {
  isAnimating: boolean;
}

export const ToolsSection: FC<ToolsSectionProps> = ({ isAnimating }) => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const { selection } = useSpineContext();
  const {
    gameId,
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
        "absolute bottom-3 left-3 z-2 flex flex-col items-center gap-y-1.5 rounded-md border-t border-surface-mid bg-surface-low py-1.5 shadow-lg transition-[width,padding]",
        menuIsCollapsed ? "w-10 px-0.5" : "w-50 px-1.5",
      ])}
    >
      {visibleTools.length > 0 && (
        <div
          className={joinClasses([
            "flex flex-wrap items-center gap-1.5 transition-[translate,opacity]",
            menuIsCollapsed ? "w-8" : "w-46",
            isAnimating
              ? "translate-y-6 opacity-0 duration-0"
              : "duration-200",
          ])}
        >
          {visibleTools.map((starter) => (
            <ToolButton
              isRunning={isToolRunning(starter.exePath)}
              key={starter.id}
              starter={starter}
              onClick={() => startTool(starter)}
            />
          ))}
        </div>
      )}

      <PlayButton
        disabled={exclusiveRunning || isPrimaryRunning || !primaryStarter}
        isCollapsed={menuIsCollapsed}
        isPrimaryRunning={isPrimaryRunning}
        primaryStarter={primaryStarter}
        onClick={handlePlay}
      />
    </div>
  );
};
