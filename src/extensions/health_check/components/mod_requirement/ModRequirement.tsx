import { mdiCheck, mdiDiamondStone, mdiDownload, mdiOpenInNew, mdiWeb } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import type { IModFileInfo, IModRequirementExt } from "../../types";

import { NexusMods } from "../../../../tailwind/components/icons/NexusMods";
import { Button } from "../../../../renderer/tailwind/components/next/button";
import { Icon } from "../../../../renderer/tailwind/components/next/icon";
import { Typography } from "../../../../renderer/tailwind/components/next/typography";
import { opn } from "../../../../util/api";
import { bytesToString } from "../../../../util/util";

export const ModRequirement = ({
  mod,
  modFiles,
  loadingFiles,
  onShowVortexModal,
  onDownload,
  onConfirmInstall,
}: {
  mod: IModRequirementExt;
  modFiles?: IModFileInfo[];
  loadingFiles?: boolean;
  onShowVortexModal?: () => void;
  onDownload: (mod: IModRequirementExt, file?: IModFileInfo) => void;
  onConfirmInstall?: () => void;
}) => {
  const { t } = useTranslation(["health_check"]);

  const hasFiles = modFiles && modFiles.length > 0;
  const previewImageSrc = modFiles?.[0]?.thumbnailUrl || "";

  return (
    <div className="space-y-2">
      <Typography appearance="moderate" as="div" className="space-y-2">
        <p className="font-semibold">{t("detail::item::missing_mod")}</p>

        {!!mod.notes && (
          <p>{`${t("detail::item::author_note")}: ${mod.notes}`}</p>
        )}
      </Typography>

      <div className="space-y-2 rounded-sm bg-surface-mid px-4 py-3">
        <div className="flex items-center gap-x-2">
          <div className="flex grow items-center gap-x-2">
            <div className="relative flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stroke-weak bg-surface-translucent-low">
              <img
                alt=""
                className="absolute max-h-full"
                src={previewImageSrc}
              />
            </div>

            <div>
              <Typography>{mod.modName}</Typography>

              <Typography appearance="subdued" typographyType="body-sm">
                {t("detail::item::check_the_description")}
              </Typography>
            </div>
          </div>

          <div className="flex shrink-0 gap-x-2">
            {mod.externalRequirement ? (
              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath={mdiWeb}
                rightIconPath={mdiOpenInNew}
                size="sm"
                onClick={() => opn(mod.modUrl).catch(() => null)}
              >
                {t("detail::item::open_external_mod_page")}
              </Button>
            ) : (
              <>
                <Button
                  buttonType="tertiary"
                  filled="weak"
                  leftIcon={NexusMods}
                  size="sm"
                  onClick={() => opn(mod.modUrl).catch(() => null)}
                >
                  {t("detail::item::open_mod_page")}
                </Button>

                <Button
                  buttonType="secondary"
                  filled="strong"
                  leftIconPath={mdiDownload}
                  rightIcon={
                    <span className="-m-1 flex size-5 items-center justify-center rounded-sm bg-premium-moderate text-neutral-strong">
                      <Icon
                        className="size-4"
                        path={mdiDiamondStone}
                        size="none"
                      />
                    </span>
                  }
                  size="sm"
                  onClick={onShowVortexModal}
                >
                  {t("detail::item::install_in_app")}
                </Button>
              </>
            )}
          </div>
        </div>

        {mod.externalRequirement && (
          <div className="flex items-center rounded-sm bg-info-weak/20 p-3">
            <Typography
              appearance="none"
              as="div"
              className="grow text-info-strong"
              typographyType="body-sm"
            >
              {t("detail::item::after_installing")}
            </Typography>

            <Button
              buttonType="tertiary"
              filled="weak"
              leftIconPath={mdiCheck}
              size="sm"
              onClick={onConfirmInstall}
            >
              {t("detail::item::confirm_install")}
            </Button>
          </div>
        )}

        {!mod.externalRequirement && (loadingFiles || hasFiles) && (
          <div className="space-y-2">
            <Typography appearance="moderate" typographyType="body-sm">
              Available files {!loadingFiles && `(${modFiles.length}):`}
            </Typography>

            <div className="max-h-48 space-y-1 overflow-y-auto">
              {loadingFiles ? (
                <div className="flex animate-pulse items-center gap-x-4 rounded-sm bg-surface-translucent-mid px-3 py-2">
                  <div className="grow space-y-1.5">
                    <div className="h-5 w-1/3 rounded-sm bg-surface-translucent-mid" />

                    <div className="flex gap-x-1">
                      <div className="h-4 w-12 rounded-sm bg-surface-translucent-mid" />

                      <div className="h-4 w-12 rounded-sm bg-surface-translucent-mid" />

                      <div className="h-4 w-12 rounded-sm bg-surface-translucent-mid" />
                    </div>
                  </div>

                  <div className="h-7 w-24 shrink-0 rounded-sm bg-surface-translucent-mid" />
                </div>
              ) : (
                <>
                  {modFiles.map((file) => (
                    <div
                      className="flex items-center justify-between rounded-sm border border-stroke-weak bg-surface-translucent-low px-3 py-2 transition-colors hover:bg-surface-translucent-mid"
                      key={file.fileId}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-x-2">
                          <Typography className="truncate">
                            {file.name}
                          </Typography>

                          {file.isPrimary && (
                            <span className="shrink-0 rounded-sm bg-premium-moderate px-1.5 py-0.5 text-xs text-neutral-strong">
                              Primary
                            </span>
                          )}
                        </div>

                        <Typography
                          appearance="subdued"
                          className="truncate"
                          typographyType="body-sm"
                        >
                          {`v${file.version} • ${file.categoryName} • ${bytesToString(file.size)}`}
                        </Typography>
                      </div>

                      <Button
                        buttonType="tertiary"
                        filled="weak"
                        leftIconPath={mdiDownload}
                        size="sm"
                        onClick={() => onDownload(mod, file)}
                      >
                        Download
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
