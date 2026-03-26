import {
  mdiArrowDown,
  mdiArrowUp,
  mdiPencil,
  mdiPin,
  mdiPinOff,
  mdiPlay,
  mdiRocket,
  mdiRocketOutline,
  mdiWrench,
} from "@mdi/js";
import React, { FC } from "react";
import { Image } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { pathToFileURL } from "url";

import type { IStarterInfo } from "../../../util/StarterInfo";

import { Button } from "../../../ui/components/button/Button";
import { Icon } from "../../../ui/components/icon/Icon";
import { Typography } from "../../../ui/components/typography/Typography";
import StarterInfo from "../../../util/StarterInfo";

export interface ToolRowProps {
  starter: IStarterInfo;
  counter: number;
  isValid: boolean;
  isPrimary: boolean;
  isPinned: boolean;
  isRunning: boolean;
  showReorder?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  pinDisabled?: boolean;
  pinDisabledReason?: string;
  onRun: (starter: StarterInfo) => void;
  onEdit: (starter: StarterInfo) => void;
  onSetPrimary: (starter: StarterInfo) => void;
  onTogglePin: (starter: IStarterInfo) => void;
  onMoveUp?: (starter: IStarterInfo) => void;
  onMoveDown?: (starter: IStarterInfo) => void;
}

export const ToolRow: FC<ToolRowProps> = ({
  starter,
  counter,
  isValid,
  isPrimary,
  isPinned,
  isRunning,
  showReorder = false,
  isFirst = false,
  isLast = false,
  pinDisabled = false,
  pinDisabledReason,
  onRun,
  onEdit,
  onSetPrimary,
  onTogglePin,
  onMoveUp,
  onMoveDown,
}: ToolRowProps) => {
  const { t } = useTranslation();
  const starterInfo = starter as StarterInfo;

  let iconSrc: string | undefined;
  try {
    const iconPath = StarterInfo.getIconPath(starter);
    if (iconPath !== undefined) {
      iconSrc = pathToFileURL(iconPath).href + "?" + counter;
    }
  } catch {
    // ignore - will show fallback
  }

  return (
    <div className="hover-overlay-weak flex w-full items-center gap-x-3 rounded-sm bg-surface-mid px-4 py-3 shadow-xs">
      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xs">
        {iconSrc ? (
          <Image src={iconSrc} className="size-full object-contain" />
        ) : (
          <Icon className="text-translucent-moderate" path={mdiWrench} />
        )}
      </div>

      <div className="grow space-y-0.5">
        <Typography>{starterInfo.name}</Typography>
        {isRunning && (
          <Typography appearance="subdued" typographyType="body-sm">
            {t("Running...")}
          </Typography>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-x-1">
        {showReorder && isPinned && (
          <>
            <Button
              buttonType="tertiary"
              leftIconPath={mdiArrowUp}
              size="xs"
              title={isFirst ? t("Already at the top") : t("Move up")}
              disabled={isFirst}
              onClick={() => onMoveUp?.(starter)}
            />
            <Button
              buttonType="tertiary"
              leftIconPath={mdiArrowDown}
              size="xs"
              title={isLast ? t("Already at the bottom") : t("Move down")}
              disabled={isLast}
              onClick={() => onMoveDown?.(starter)}
            />
          </>
        )}

        {!starter.isGame && (
          <Button
            buttonType="tertiary"
            leftIconPath={isPinned ? mdiPinOff : mdiPin}
            size="xs"
            title={
              !isPinned && pinDisabled
                ? pinDisabledReason
                : isPinned
                  ? t("Unpin tool")
                  : t("Pin tool")
            }
            disabled={!isPinned && pinDisabled}
            onClick={() => onTogglePin(starter)}
          />
        )}

        <Button
          buttonType="tertiary"
          leftIconPath={isPrimary ? mdiRocketOutline : mdiRocket}
          size="xs"
          title={
            isPrimary
              ? t("Remove default launcher")
              : t("Set as default launcher — replaces the current one")
          }
          disabled={!isPrimary && !isValid}
          onClick={() => onSetPrimary(starterInfo)}
        />

        <Button
          buttonType="tertiary"
          leftIconPath={mdiPencil}
          size="xs"
          title={t("Edit tool")}
          onClick={() => onEdit(starterInfo)}
        />

        <Button
          buttonType="secondary"
          filled="strong"
          leftIconPath={mdiPlay}
          size="sm"
          title={t("Launch tool")}
          disabled={!isValid}
          onClick={() => onRun(starterInfo)}
        />
      </div>
    </div>
  );
};
