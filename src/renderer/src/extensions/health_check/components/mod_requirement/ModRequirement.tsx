import {
  mdiCallSplit,
  mdiChevronRight,
  mdiDownload,
  mdiEye,
  mdiEyeOff,
  mdiThumbDown,
  mdiThumbUp,
} from "@mdi/js";
import React, { type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IModRequirementExt } from "../../types";
import {
  getIssueMessageKey,
  getMockIssueType,
  issueTypeSeverityMap,
} from "../../utils/issueMessages";
import { severityStyleMap } from "../../utils/severityStyles";

interface IModRequirementProps {
  isHidden?: boolean;
  requirementInfo: IModRequirementExt;
  onClick: () => void;
  onToggleHide?: (e: MouseEvent) => void;
}

export const ModRequirement = ({
  isHidden,
  onClick,
  onToggleHide,
  requirementInfo,
}: IModRequirementProps) => {
  const { t } = useTranslation("health_check");

  // todo delete, derive the issue type from requirementInfo
  const issueType = React.useMemo(getMockIssueType, []);
  const severityStyle = severityStyleMap[issueTypeSeverityMap[issueType]];

  // todo delete, this is a temp var for showing different UI states
  const isOr = React.useMemo(() => Math.random() < 0.5, []);

  return (
    <div
      className="group hover-overlay-weak flex w-full cursor-pointer items-start gap-x-4 rounded-sm bg-surface-mid px-4 py-3 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info-subdued"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e: KeyboardEvent) => {
        if (["Enter", " "].includes(e.key)) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Icon
        className={joinClasses(["shrink-0", severityStyle.textClassName])}
        path={severityStyle.iconPath}
      />

      <div className="min-w-0 grow space-y-0.5 text-left">
        <div className="flex items-start justify-between gap-x-4">
          <div className="min-w-0">
            <Typography className="truncate" isTranslucent={true}>
              {`${t(getIssueMessageKey(issueType))} `}

              {requirementInfo.requiredBy.modName}
            </Typography>

            <Typography appearance="subdued" typographyType="body-sm">
              {/* todo pass in the correct count */}
              {t(isOr ? "listing::item::may_require_mods" : "listing::item::requires_mods", {
                count: 3,
              })}

              {`:`}
            </Typography>
          </div>

          <div className="invisible flex gap-x-1 group-focus-within:visible group-hover:visible">
            {/* todo make this button work */}
            <Button
              buttonType="tertiary"
              // disabled={givenFeedBack}
              leftIconPath={mdiThumbUp}
              size="sm"
              title={t("common:::helpful")}
              onClick={() => console.log("todo")}
            />

            {/* todo make this button work */}
            <Button
              buttonType="tertiary"
              // disabled={givenFeedBack}
              leftIconPath={mdiThumbDown}
              size="sm"
              title={t("common:::not_helpful")}
              onClick={() => console.log("todo")}
            />

            <Button
              buttonType="tertiary"
              leftIconPath={isHidden ? mdiEye : mdiEyeOff}
              size="sm"
              title={isHidden ? t("common:::unhide") : t("common:::hide")}
              onClick={(e) => {
                e.stopPropagation();
                onToggleHide?.(e);
              }}
            />
          </div>
        </div>

        <Typography
          appearance="subdued"
          className="flex items-center gap-x-3"
          typographyType="body-sm"
        >
          {/* todo get the mod page name */}
          <span className={joinClasses("truncate", { "max-w-1/2": isOr })}>
            Some long file name the we truncate at a certain point
          </span>

          {isOr ? (
            <>
              <span>or</span>

              {/* todo get the mod page name */}
              <span className="truncate">
                Some long file name the we truncate at a certain point
              </span>
            </>
          ) : (
            <span className="whitespace-nowrap">
              {/* todo pass in the correct count */}
              {t("listing::item::more_count", { count: 2 })}
            </span>
          )}
        </Typography>
      </div>

      {/* todo make these button work */}
      {isOr ? (
        <Button
          buttonType="tertiary"
          className="self-start"
          filled="weak"
          leftIconPath={mdiCallSplit}
          size="sm"
          onClick={() => console.log("todo")}
        >
          {t("listing::pick_mod_install")}
        </Button>
      ) : (
        <Button
          buttonType="tertiary"
          className="self-start"
          filled="weak"
          leftIconPath={mdiDownload}
          rightIcon={<PremiumBadge />}
          size="sm"
          onClick={() => console.log("todo")}
        >
          {/* todo pass in the correct count */}
          {t("listing::install_one_click", { count: 3 })}
        </Button>
      )}

      <Icon className="shrink-0 text-translucent-moderate" path={mdiChevronRight} size="lg" />
    </div>
  );
};
