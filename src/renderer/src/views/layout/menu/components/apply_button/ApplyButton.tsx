import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface IApplyButtonProps {
  isCollapsed: boolean;
  /**
   * A purge is running. Shown in Apply's place in its own neutral colours, so it doesn't look
   * like an apply started without the user; `progress` is then the purge's.
   */
  isPurging?: boolean;
  /** 0-100 while a deployment or purge runs; undefined when idle. */
  progress?: number;
  /** What the deploy is doing, e.g. the mod it's on, shown under the tooltip while applying. */
  step?: string;
  onClick: () => void;
}

const Content = ({
  isBusy = false,
  isCollapsed,
  isPurging = false,
  label,
}: {
  isBusy?: boolean;
  isCollapsed: boolean;
  isPurging?: boolean;
  label: string;
}) => (
  <>
    <Icon
      className={joinClasses([
        "nxm-button-icon",
        { "animate-spin reduce-motion:animate-none": isBusy },
      ])}
      name="autorenew"
      size="lg"
    />

    {!isCollapsed && (
      <Typography
        // While busy the bar sets the colour, so the text picks it up from there.
        {...(isBusy ? { brand: "none" as const } : { appearance: "inverted" as const })}
        as="span"
        className="font-medium"
        typographyType={isPurging ? "body-md" : "body-lg"}
      >
        {label}
      </Typography>
    )}
  </>
);

/**
 * Deploys pending mod changes. Shown beside Play only while there is something to deploy.
 * While it deploys, the whole button becomes a progress bar: not a button at all, so it has
 * no hover or press state and can't start a second deployment. A running purge shows the same
 * way, in neutral colours.
 */
export const ApplyButton = ({
  isCollapsed,
  isPurging = false,
  progress,
  step,
  onClick,
}: IApplyButtonProps) => {
  const { t } = useTranslation();
  const isBusy = progress !== undefined;
  const isApplying = isBusy && !isPurging;
  const label = isPurging ? t("Updating files") : isApplying ? t("Applying") : t("Apply");
  const showStep = isApplying && !!step;
  const height = isCollapsed ? "h-10" : "h-12";

  const headline = isPurging
    ? t("Updating mod files")
    : !isApplying
      ? t("Apply your mod changes to the game")
      : showStep
        ? t("Applying mod changes")
        : t("Applying mod changes…");

  return (
    <div className={joinClasses(["relative", isCollapsed ? "w-full" : "min-w-0 flex-1"])}>
      <Tooltip
        closeOnPress={false}
        customContent={
          <div className="nxm-tooltip-content space-y-0.5">
            <p>{headline}</p>

            {isPurging && (
              <p className="text-neutral-subdued">
                {t("Vortex is updating which files are in the game after your last change.")}
              </p>
            )}

            {showStep && <p className="truncate text-neutral-subdued">{step}</p>}
          </div>
        }
        placement="right"
      >
        {isBusy ? (
          <div
            aria-label={label}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className={joinClasses([
              "relative flex w-full cursor-progress items-center justify-center gap-x-2 overflow-hidden rounded-sm px-2",
              isPurging ? "bg-neutral-weak text-neutral-900" : "bg-primary-600/80 text-primary-950",
              height,
            ])}
            data-testid="menu-apply"
            role="progressbar"
          >
            <div
              className={joinClasses([
                "absolute inset-y-0 left-0 transition-[width] duration-300 reduce-motion:duration-0",
                isPurging ? "bg-neutral-moderate" : "bg-primary-moderate",
              ])}
              style={{ width: `${progress}%` }}
            />

            <span className="relative flex items-center gap-x-2">
              <Content isBusy isCollapsed={isCollapsed} isPurging={isPurging} label={label} />
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
