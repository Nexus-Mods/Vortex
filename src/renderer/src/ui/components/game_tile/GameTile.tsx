import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Tier } from "@/extensions/gamemode_management/tiered/types";
import { Icon, type IIconSource } from "@/ui/components/icon/Icon";
import { Image } from "@/ui/components/image/Image";
import { Pill } from "@/ui/components/pill/Pill";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import {
  nxmElectronicArts,
  nxmEpicGames,
  nxmGog,
  nxmSteam,
  nxmUbisoft,
  nxmXbox,
} from "@/ui/icon-paths";
import { joinClasses } from "@/ui/utils/joinClasses";

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Known stores, keyed by the id `IDiscoveryResult.store` carries. */
const STORES: Record<string, { icon: IIconSource; label: string }> = {
  epic: { icon: { path: nxmEpicGames }, label: "Epic" },
  gog: { icon: { path: nxmGog }, label: "GOG" },
  origin: { icon: { path: nxmElectronicArts }, label: "Origin" },
  steam: { icon: { path: nxmSteam }, label: "Steam" },
  uplay: { icon: { path: nxmUbisoft }, label: "Ubisoft" },
  xbox: { icon: { path: nxmXbox }, label: "Xbox" },
};

export interface IGameTileProps {
  className?: string;
  highlighted?: boolean;
  /** the game's support tier, shown as a small pill */
  supportTier?: Tier;
  supportedBy?: string;
  imageUrl?: string;
  menu?: { actions: IMenuAction[][]; label: string };
  name: string;
  primaryAction?: ReactNode;
  revealPrimaryAction?: boolean;
  store?: string;
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
  highlighted,
  supportTier,
  supportedBy,
  imageUrl,
  menu,
  name,
  primaryAction,
  revealPrimaryAction,
  store,
}: IGameTileProps) => {
  const { t } = useTranslation();
  const knownStore = store === undefined ? undefined : STORES[store];

  const revealedWhenActive =
    "opacity-0 transition-opacity group-has-focus-visible/tile:opacity-100 group-hover/tile:opacity-100 group-data-menu-open/tile:opacity-100";

  const highlightedTile = joinClasses([
    "border border-primary-moderate/50",
    "hover:border-primary-strong",
    "hover:shadow-[0_0_1px_var(--color-primary-200),0_0_2px_var(--color-primary-500),0_0_34px_color-mix(in_srgb,var(--color-primary-500)_50%,transparent),0_4px_14px_color-mix(in_srgb,var(--color-black)_45%,transparent)]",
  ]);

  const liftsWithAction = joinClasses([
    "translate-y-9 transition-[translate]",
    "group-hover/tile:translate-y-0",
    "group-has-focus-visible/tile:translate-y-0",
    "group-data-menu-open/tile:translate-y-0",
    "reduce-motion:translate-y-0 reduce-motion:transition-none",
  ]);

  return (
    <Popover className="contents">
      {({ open }) => (
        <Image
          alt={name}
          className={joinClasses(["relative w-full rounded-lg shadow-sm", className], {
            [highlightedTile]: highlighted,
          })}
          data-testid="game-tile"
          decoding="async"
          fit="cover"
          imageType="game"
          loading="lazy"
          src={imageUrl}
        >
          <div
            className="group/tile absolute inset-0 z-1 flex flex-col justify-between overflow-hidden bg-linear-to-t from-scrim-strong via-scrim-moderate via-30% to-scrim-weak to-85% p-3"
            data-menu-open={open || undefined}
          >
            <div className="flex gap-x-4">
              {!!supportTier && (
                <Pill appearance="scrim" brand="light">
                  {supportTier}
                </Pill>
              )}

              {!!store && (
                <Pill appearance="scrim" brand="light" icon={knownStore?.icon}>
                  {knownStore?.label ?? titleCase(store)}
                </Pill>
              )}

              {!!menu && (
                <div className="ml-auto">
                  <Tooltip content={t("More")} disabled={open} placement="top">
                    <PopoverButton
                      appearance="scrim"
                      aria-haspopup="menu"
                      aria-label={menu.label}
                      brand="neutral"
                      className={revealedWhenActive}
                      leftIcon="more_vert"
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

            <div
              className={joinClasses("flex flex-col gap-y-2", {
                [liftsWithAction]: revealPrimaryAction,
              })}
            >
              <div className="space-y-1">
                {!!supportedBy && (
                  <Tooltip
                    content={t("Game supported by {{name}}", { replace: { name: supportedBy } })}
                    placement="top"
                  >
                    <div className={joinClasses(["flex items-center gap-x-1", revealedWhenActive])}>
                      <Icon filled className="text-primary-moderate" name="person" size="xs" />

                      <Typography
                        appearance="moderate"
                        brand="neutral-on-scrim"
                        typographyType="body-xs"
                      >
                        {t("Community supported")}
                      </Typography>
                    </div>
                  </Tooltip>
                )}

                <Typography brand="neutral-on-scrim" className="line-clamp-2 font-semibold">
                  {name}
                </Typography>
              </div>

              {!!primaryAction &&
                (revealPrimaryAction ? (
                  <div className={revealedWhenActive}>{primaryAction}</div>
                ) : (
                  primaryAction
                ))}
            </div>
          </div>
        </Image>
      )}
    </Popover>
  );
};
