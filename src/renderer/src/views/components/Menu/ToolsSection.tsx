import { pathToFileURL } from "url";

import { mdiPlay } from "@mdi/js";
import React, { type FC, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useWindowContext } from "@/contexts";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Image } from "@/ui/components/image/Image";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { IStarterInfo } from "@/util/StarterInfo";
import StarterInfo from "@/util/StarterInfo";

import { useSpineContext } from "../Spine/SpineContext";
import { formatGameDisplayName } from "../Spine/utils";
import { ToolButton } from "./ToolButton";
import { useToolsContext } from "./ToolsContext";

interface PlayButtonProps {
  primaryStarter: IStarterInfo | undefined;
  gameName: string | undefined;
  isPrimaryRunning: boolean;
  isCollapsed: boolean;
  disabled: boolean;
  onClick: () => void;
}

const PlayButton: FC<React.PropsWithChildren<PlayButtonProps>> = ({
  primaryStarter,
  gameName,
  isPrimaryRunning,
  isCollapsed,
  disabled,
  onClick,
}) => {
  const { t } = useTranslation();

  const launcherIconSrc = useMemo(() => {
    if (!primaryStarter) return undefined;
    try {
      const iconPath = StarterInfo.getIconPath(primaryStarter);
      if (iconPath) {
        return pathToFileURL(iconPath).href.replace("'", "%27");
      }
    } catch {
      // ignore
    }
    return undefined;
  }, [primaryStarter]);

  const label = isPrimaryRunning ? t("Running...") : t("Play");

  /** What the button says it will do, for the tooltip's first line and the aria-label. */
  const playLabel = isPrimaryRunning
    ? t("Running...")
    : gameName
      ? t("Play {{game}}", { replace: { game: formatGameDisplayName(gameName) } })
      : t("Play");

  return (
    <div className="relative w-full">
      <Tooltip
        customContent={
          <div className="space-y-1 px-4 py-3">
            <Typography
              appearance="moderate"
              as="p"
              className="font-semibold"
              typographyType="body-sm"
            >
              {playLabel}
            </Typography>

            {!!primaryStarter && (
              <>
                <Typography appearance="subdued" as="p" typographyType="body-sm">
                  {t("Launch with")}
                </Typography>

                <div className="flex items-center gap-x-1.5">
                  {!!launcherIconSrc && (
                    <Image
                      alt=""
                      className="size-5 shrink-0 rounded-xs"
                      imageType="other"
                      src={launcherIconSrc}
                    />
                  )}

                  <Typography appearance="moderate" as="span" typographyType="body-sm">
                    {primaryStarter.name}
                  </Typography>
                </div>
              </>
            )}
          </div>
        }
        placement="right"
      >
        <Button
          aria-label={isCollapsed ? playLabel : undefined}
          brand="neutral"
          className={joinClasses(["w-full transition-all", isCollapsed ? "h-10" : "h-12"])}
          customContent={
            <>
              <Icon className="nxm-button-icon" path={mdiPlay} size="lg" />

              {!isCollapsed && (
                <Typography
                  appearance="inverted"
                  as="span"
                  className="font-semibold"
                  typographyType="body-lg"
                >
                  {label}
                </Typography>
              )}
            </>
          }
          disabled={disabled}
          onClick={onClick}
        />
      </Tooltip>
    </div>
  );
};

interface ToolsSectionProps {
  isAnimating: boolean;
}

export const ToolsSection: FC<React.PropsWithChildren<ToolsSectionProps>> = ({ isAnimating }) => {
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
        <div
          className={joinClasses([
            "flex items-center gap-1 border-b border-stroke-weak pb-3 transition-[translate,opacity]",
            menuIsCollapsed ? "w-10 flex-wrap justify-center" : "w-full flex-wrap-reverse",
            isAnimating ? "translate-y-6 opacity-0 duration-0" : "duration-200",
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
        gameName={gameName}
        isCollapsed={menuIsCollapsed}
        isPrimaryRunning={isPrimaryRunning}
        primaryStarter={primaryToolId ? primaryStarter : undefined}
        onClick={handlePlay}
      />
    </div>
  );
};
