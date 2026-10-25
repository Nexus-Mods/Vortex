import numeral from "numeral";
import React, { type PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

import { Bullet } from "@/ui/components/bullet/Bullet";
import { Button } from "@/ui/components/button/Button";
import { Icon, type IIconSource } from "@/ui/components/icon/Icon";
import { getIconProps } from "@/ui/components/icon/utils/icon_props/iconProps.util";
import { Image } from "@/ui/components/image/Image";
import { Typography } from "@/ui/components/typography/Typography";

import type { ICatalogMod, InstallState } from "../types";
import { formatDate } from "./formatDate";
import { InstallStateLabel } from "./InstallStateLabel";

export interface IModTileProps {
  mod: ICatalogMod;
  installState: InstallState;
  isLoggedIn: boolean;
  installing: boolean;
  onOpen: () => void;
  onInstall: () => void;
}

const Stat = ({
  children,
  icon,
  title,
}: PropsWithChildren<{ icon: IIconSource; title: string }>) => (
  <div className="flex items-center gap-x-1" title={title}>
    <Icon {...getIconProps(icon)} className="text-neutral-subdued" size="sm" />

    <Typography appearance="moderate" typographyType="body-sm">
      {children}
    </Typography>
  </div>
);

/** A mod in the catalog grid, laid out like the collection tiles on the Browse page. */
export const ModTile = ({
  mod,
  installState,
  isLoggedIn,
  installing,
  onOpen,
  onInstall,
}: IModTileProps) => {
  const { t, i18n } = useTranslation(["common"]);

  const installLabel =
    installState === "update-available"
      ? t("Update")
      : installState === "installed"
        ? t("Install again")
        : t("Install");

  return (
    <div className="flex w-full flex-col rounded-md bg-surface-mid" data-testid="catalog-mod-tile">
      <button
        className="flex grow items-start gap-x-3.5 p-3 text-left"
        title={t("Show details")}
        type="button"
        onClick={onOpen}
      >
        <Image
          alt={mod.name}
          className="aspect-video w-full max-w-35 shrink-0 rounded-xs"
          fit="cover"
          imageType="mod"
          src={mod.thumbnailUrl}
        />

        <div className="flex min-w-0 grow flex-col gap-y-1.5">
          <div className="flex flex-col gap-y-1">
            <Typography className="truncate font-semibold" typographyType="body-lg">
              {mod.name}
            </Typography>

            <Typography appearance="moderate" className="truncate" typographyType="body-sm">
              {t("by {{author}}", { replace: { author: mod.author } })}
            </Typography>
          </div>

          <div className="flex items-center gap-x-1.5 border-t border-stroke-weak pt-1.5">
            {mod.category !== undefined && (
              <Typography brand="info" className="truncate" typographyType="body-sm">
                {mod.category}
              </Typography>
            )}

            {mod.adultContent && (
              <>
                <Bullet />

                <Typography brand="danger" typographyType="body-sm">
                  {t("Adult")}
                </Typography>
              </>
            )}

            <InstallStateLabel state={installState} />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 border-t border-stroke-weak pt-1.5">
            <Stat icon="download" title={t("Downloads")}>
              {numeral(mod.downloads).format("0.[0] a")}
            </Stat>

            <Stat icon={{ name: "thumb_up", filled: true }} title={t("Endorsements")}>
              {numeral(mod.endorsements).format("0.[0] a")}
            </Stat>

            <Stat icon="update" title={t("Last updated")}>
              {formatDate(mod.updatedAt, i18n?.language)}
            </Stat>
          </div>

          <Typography
            appearance="subdued"
            className="line-clamp-3 border-t border-stroke-weak pt-1.5 wrap-break-word"
            typographyType="body-sm"
          >
            {mod.summary}
          </Typography>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-x-2 rounded-b bg-surface-translucent-low px-3 py-2">
        <Button
          disabled={!isLoggedIn || installing}
          isLoading={installing}
          size="sm"
          title={!isLoggedIn ? t("Log in to Nexus Mods to install mods") : undefined}
          onClick={onInstall}
        >
          {!isLoggedIn ? t("Log in to install") : installLabel}
        </Button>

        <Button appearance="weak" brand="neutral" size="sm" onClick={onOpen}>
          {t("Details")}
        </Button>
      </div>
    </div>
  );
};
