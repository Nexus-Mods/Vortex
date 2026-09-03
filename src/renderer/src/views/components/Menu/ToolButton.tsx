import { pathToFileURL } from "url";

import { mdiCircleOutline, mdiLoading, mdiPlay } from "@mdi/js";
import React, { type ButtonHTMLAttributes, type FC, useMemo } from "react";

import { useWindowContext } from "@/contexts";
import { Icon } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { IStarterInfo } from "@/util/StarterInfo";

import StarterInfo from "../../../util/StarterInfo";

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  starter: IStarterInfo;
  isValid?: boolean;
  isRunning?: boolean;
}

export const ToolButton: FC<React.PropsWithChildren<ToolButtonProps>> = ({
  starter,
  isValid = true,
  isRunning = false,
  ...props
}) => {
  const { menuIsCollapsed } = useWindowContext();

  const imageSrc = useMemo(() => {
    try {
      const iconPath = StarterInfo.getIconPath(starter);
      if (iconPath) {
        return pathToFileURL(iconPath).href.replace("'", "%27");
      }
      return undefined;
    } catch {
      return undefined;
    }
  }, [starter]);

  return (
    <Tooltip
      content={isValid ? starter.name : `${starter.name} (Not configured)`}
      placement={menuIsCollapsed ? "right" : "top"}
    >
      <button
        aria-label={starter.name}
        className={joinClasses("group/tool-button relative size-9 shrink-0 rounded-sm", {
          "pointer-events-none cursor-not-allowed": isRunning,
        })}
        {...props}
      >
        {imageSrc ? (
          <img
            alt={starter.name}
            className={joinClasses("absolute inset-0 size-full rounded-sm object-cover", {
              "opacity-40 grayscale": !isValid,
            })}
            src={imageSrc}
          />
        ) : (
          <Typography
            appearance="moderate"
            as="span"
            className={joinClasses(
              "absolute inset-0 flex items-center justify-center rounded-sm bg-surface-high leading-none",
              { "opacity-40": !isValid },
            )}
            typographyType="body-lg"
          >
            {starter.name?.charAt(0)?.toUpperCase() || "?"}
          </Typography>
        )}

        <span
          className={joinClasses(
            [
              "absolute inset-0 z-1 flex items-center justify-center rounded-sm border border-surface-low transition-colors",
              "group-hover/tool-button:border-stroke-strong group-hover/tool-button:bg-translucent-600",
              "group-focus-visible/tool-button:border-stroke-strong group-focus-visible/tool-button:bg-translucent-600",
            ],
            { "border-stroke-strong bg-translucent-600": isRunning },
          )}
        >
          <span
            className={joinClasses(
              [
                "relative text-neutral-inverted opacity-0 transition-opacity",
                "group-hover/tool-button:opacity-100",
                "group-focus-visible/tool-button:opacity-100",
              ],
              { "animate-spin opacity-100": isRunning },
            )}
          >
            {isRunning ? (
              <>
                <Icon className="opacity-40" path={mdiCircleOutline} />

                <Icon className="absolute inset-0" path={mdiLoading} />
              </>
            ) : (
              <Icon path={mdiPlay} />
            )}
          </span>
        </span>
      </button>
    </Tooltip>
  );
};
