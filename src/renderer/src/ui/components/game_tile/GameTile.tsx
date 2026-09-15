import { mdiDotsVertical } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Image } from "@/ui/components/image/Image";
import { Pill } from "@/ui/components/pill/Pill";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverMenu } from "@/ui/components/popover/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/PopoverMenuItem";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { nxmModOutline } from "@/ui/icon-paths";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface IGameTileProps {
  className?: string;
  contributedBy?: string;
  imageUrl?: string;
  menu?: { actions: IMenuAction[][]; label: string };
  modCount?: number;
  name: string;
  primaryAction?: { label: string; onClick: () => void };
}

/**
 * A game as a card: its art, its name, and how much of it is switched on.
 *
 * Hovering hands the art over to the primary action — the art dims and the action sits
 * on top of it — so the tile carries one obvious thing to do without spending its
 * resting state on a button. Reaching the action by keyboard reveals it the same way.
 */
export const GameTile = ({
  className,
  contributedBy,
  imageUrl,
  menu,
  modCount,
  name,
  primaryAction,
}: IGameTileProps) => {
  const { t } = useTranslation();
  const revealedWhenActive =
    "opacity-0 transition-opacity group-has-focus-visible/tile:opacity-100 group-hover/tile:opacity-100 group-data-menu-open/tile:opacity-100";

  return (
    <Popover className="contents">
      {({ open }) => (
        <Image
          alt={name}
          className={joinClasses(["relative w-full rounded-sm", className])}
          data-testid="game-tile"
          decoding="async"
          fit="cover"
          imageType="game"
          loading="lazy"
          src={imageUrl}
        >
          <div
            className={joinClasses([
              "group/tile absolute inset-0 z-1 flex flex-col justify-between bg-linear-to-t from-translucent-dark-900 via-translucent-dark-500 to-transparent p-3",
              "hover:via-translucent-dark-700 has-focus-visible:via-translucent-dark-700 data-menu-open:via-translucent-dark-700",
              "hover:to-translucent-dark-900 has-focus-visible:to-translucent-dark-900 data-menu-open:to-translucent-dark-900",
            ])}
            data-menu-open={open || undefined}
          >
            <div className="flex gap-x-4">
              {!!contributedBy && (
                <Tooltip
                  content={t("Contributed by {{name}}", { replace: { name: contributedBy } })}
                  placement="bottom"
                >
                  <Pill className={revealedWhenActive}>{t("Community")}</Pill>
                </Tooltip>
              )}

              {!!menu && (
                <div className="ml-auto">
                  <Tooltip content={menu.label} disabled={open} placement="bottom">
                    <PopoverButton
                      appearance="moderate"
                      aria-haspopup="menu"
                      aria-label={menu.label}
                      brand="neutral"
                      className={revealedWhenActive}
                      leftIconPath={mdiDotsVertical}
                      size="sm"
                    />
                  </Tooltip>

                  <PopoverPanel className="nxm-popover-panel-dropdown">
                    {({ close }) => (
                      <PopoverMenu actions={menu.actions} label={menu.label} onSelect={close} />
                    )}
                  </PopoverPanel>
                </div>
              )}
            </div>

            {!!primaryAction && (
              <div
                className={joinClasses([
                  revealedWhenActive,
                  "absolute inset-0 flex items-center justify-center",
                ])}
              >
                <Button size="sm" onClick={primaryAction.onClick}>
                  {primaryAction.label}
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-y-1">
              <Typography typographyType="body-sm">{name}</Typography>

              {!!modCount && (
                <Pill data-testid="game-tile-mod-count" iconPath={nxmModOutline} pillType="success">
                  {t("{{ count }} active mod", { count: modCount })}
                </Pill>
              )}
            </div>
          </div>
        </Image>
      )}
    </Popover>
  );
};
