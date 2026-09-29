import { mdiAutorenew } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface IApplyButtonProps {
  isCollapsed: boolean;
  /** 0-100 while a deployment runs; undefined when idle. */
  progress?: number;
  /** What the deploy is doing, e.g. the mod it's on, shown under the tooltip while applying. */
  step?: string;
  onClick: () => void;
}

const Content = ({
  isApplying = false,
  isCollapsed,
  label,
}: {
  isApplying?: boolean;
  isCollapsed: boolean;
  label: string;
}) => (
  <>
    <Icon
      className={joinClasses([
        "nxm-button-icon",
        { "animate-spin reduce-motion:animate-none": isApplying },
      ])}
      path={mdiAutorenew}
      size="lg"
    />

    {!isCollapsed && (
      <Typography
        // While applying the bar sets the colour, so the text picks it up from there.
        {...(isApplying ? { brand: "none" as const } : { appearance: "inverted" as const })}
        as="span"
        className="font-semibold"
        typographyType="body-lg"
      >
        {label}
      </Typography>
    )}
  </>
);

/**
 * Deploys pending mod changes. Shown beside Play only while there is something to deploy.
 * While it deploys, the whole button becomes a progress bar: not a button at all, so it has
 * no hover or press state and can't start a second deployment.
 */
export const ApplyButton = ({ isCollapsed, progress, step, onClick }: IApplyButtonProps) => {
  const { t } = useTranslation();
  const isApplying = progress !== undefined;
  const label = isApplying ? t("Applying") : t("Apply");
  const showStep = isApplying && !!step;
  const height = isCollapsed ? "h-10" : "h-12";

  const headline = !isApplying
    ? t("Apply your mod changes to the game")
    : showStep
      ? t("Applying mod changes:")
      : t("Applying mod changes…");

  return (
    <div className={joinClasses(["relative", isCollapsed ? "w-full" : "min-w-0 flex-1"])}>
      <Tooltip
        closeOnPress={false}
        customContent={
          <div className="nxm-tooltip-content">
            <p>{headline}</p>

            {showStep && <p className="truncate text-neutral-subdued">{step}</p>}
          </div>
        }
        placement="right"
      >
        {isApplying ? (
          <div
            aria-label={label}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className={joinClasses([
              "relative flex w-full cursor-progress items-center justify-center gap-x-2 overflow-hidden rounded-sm bg-primary-600/80 px-2 text-primary-950",
              height,
            ])}
            data-testid="menu-apply"
            role="progressbar"
          >
            <div
              className="absolute inset-y-0 left-0 bg-primary-moderate transition-[width] duration-300 reduce-motion:duration-0"
              style={{ width: `${progress}%` }}
            />

            <span className="relative flex items-center gap-x-2">
              <Content isApplying isCollapsed={isCollapsed} label={label} />
            </span>
          </div>
        ) : (
          <Button
            aria-label={isCollapsed ? label : undefined}
            brand="primary"
            className={joinClasses(["w-full transition-all", height])}
            customContent={<Content isCollapsed={isCollapsed} label={label} />}
            data-testid="menu-apply"
            onClick={onClick}
          />
        )}
      </Tooltip>
    </div>
  );
};
