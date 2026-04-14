import { Menu } from "@headlessui/react";
import {
  mdiArrowDown,
  mdiArrowUp,
  mdiDelete,
  mdiDotsVertical,
  mdiPencil,
  mdiPin,
  mdiPinOff,
  mdiPlay,
  mdiFlash,
  mdiFlashOff,
} from "@mdi/js";
import React, { type FC } from "react";
import { Image } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { pathToFileURL } from "url";

import { Button } from '@/ui/components/button/Button';
import { Dropdown } from "@/ui/components/dropdown/Dropdown";
import { DropdownItem } from "@/ui/components/dropdown/DropdownItem";
import { DropdownItems } from "@/ui/components/dropdown/DropdownItems";
import { Typography } from "@/ui/components/typography/Typography";
import StarterInfo, { type IStarterInfo } from "@/util/StarterInfo";

const Divider = () => <div className="h-7 w-px bg-stroke-weak" />;

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
  onRemove: (starter: StarterInfo) => void;
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
  onRemove,
  onSetPrimary,
  onTogglePin,
  onMoveUp,
  onMoveDown,
}) => {
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
    <div className="hover-overlay-weak flex w-full min-w-0 items-center gap-x-4 rounded-sm bg-surface-mid pr-3 shadow-xs">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-l-sm bg-surface-high">
        {iconSrc ? (
          <Image src={iconSrc} />
        ) : (
          <Typography appearance="moderate" className="uppercase" typographyType="body-lg">
            {starterInfo.name?.charAt(0) || 'T'}
          </Typography>
        )}
      </div>

      <Typography as="div" className="flex min-w-0 grow items-center gap-x-2">
        <span className="truncate">
          {starterInfo.name}
        </span>

        {isRunning && (
          <span className="shrink-0 text-neutral-subdued">
            {t("Running...")}
          </span>
        )}
      </Typography>

      <div className="flex shrink-0 items-center gap-x-4">
        {showReorder && isPinned && (
          <>
            <div className="flex gap-x-2">
              <Button
                buttonType="tertiary"
                disabled={isFirst}
                leftIconPath={mdiArrowUp}
                size="sm"
                title={isFirst ? t("Already at the top") : t("Move up")}
                onClick={() => onMoveUp?.(starter)}
              />

              <Button
                buttonType="tertiary"
                disabled={isLast}
                leftIconPath={mdiArrowDown}
                size="sm"
                title={isLast ? t("Already at the bottom") : t("Move down")}
                onClick={() => onMoveDown?.(starter)}
              />
            </div>

            <Divider />
          </>
        )}

        <div className="flex gap-x-2">
          {!starter.isGame && !isPrimary && (
            <Button
              buttonType="tertiary"
              disabled={!isPinned && pinDisabled}
              leftIconPath={isPinned ? mdiPinOff : mdiPin}
              size="sm"
              title={
                !isPinned && pinDisabled
                  ? pinDisabledReason
                  : isPinned
                    ? t("Unpin tool")
                    : t("Pin tool")
              }
              onClick={() => onTogglePin(starter)}
            />
          )}

          <Dropdown>
            <Menu.Button
              as={Button}
              buttonType="tertiary"
              leftIconPath={mdiDotsVertical}
              size="sm"
            />

            <DropdownItems>
              <DropdownItem
                leftIconPath={mdiPencil}
                onClick={() => onEdit(starterInfo)}
              >
                {t("Edit")}
              </DropdownItem>

              <DropdownItem
                disabled={!isPrimary && !isValid}
                leftIconPath={isPrimary ? mdiFlashOff : mdiFlash}
                onClick={() => onSetPrimary(starterInfo)}
              >
                {isPrimary
                  ? t("Remove default launcher")
                  : t("Set as default launcher")}
              </DropdownItem>

              {!starter.isGame && (
                <DropdownItem
                  className="nxm-dropdown-item-danger"
                  leftIconPath={mdiDelete}
                  onClick={() => onRemove(starterInfo)}
                >
                  {t("Delete")}
                </DropdownItem>
              )}
            </DropdownItems>
          </Dropdown>
        </div>

        <Divider />

        <Button
          buttonType="secondary"
          disabled={!isValid}
          filled="strong"
          leftIconPath={mdiPlay}
          size="sm"
          title={t("Launch tool")}
          onClick={() => onRun(starterInfo)}
        />
      </div>
    </div>
  );
};
