import { mdiCircleOutline, mdiLoading, mdiPlay } from "@mdi/js";
import React, { type ButtonHTMLAttributes, type FC, useMemo } from "react";
import { pathToFileURL } from "url";

import type { IStarterInfo } from "../../../util/StarterInfo";

import { Icon } from "../../../ui/components/icon";
import { Typography } from "../../../ui/components/typography";
import { joinClasses } from "../../../ui/utils/join_classes";
import StarterInfo from "../../../util/StarterInfo";

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  starter: IStarterInfo;
  isPrimary?: boolean;
  isValid?: boolean;
  isRunning?: boolean;
}

export const ToolButton: FC<ToolButtonProps> = ({
  starter,
  isPrimary = false,
  isValid = true,
  isRunning = false,
  ...props
}) => {
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
    <button
      className={joinClasses(
        "group/tool-button relative size-8 shrink-0 rounded-sm",
        { "pointer-events-none cursor-not-allowed": isRunning },
      )}
      title={isValid ? starter.name : `${starter.name} (Not configured)`}
      {...props}
    >
      {imageSrc ? (
        <img
          alt={starter.name}
          className={joinClasses(
            "absolute inset-0 size-full rounded-sm object-cover",
            { "opacity-40 grayscale": !isValid },
          )}
          src={imageSrc}
        />
      ) : (
        <Typography
          appearance="moderate"
          as="span"
          className={joinClasses(
            "absolute inset-0 flex items-center justify-center bg-surface-high leading-none",
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
            "absolute inset-0 z-1 flex items-center justify-center rounded-sm border border-stroke-moderate transition-colors",
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
  );
};
