import { mdiCheck, mdiDiamondStone, mdiDownload, mdiOpenInNew, mdiWeb } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../../../ui/components/button/Button";
import { Icon } from "../../../../ui/components/icon/Icon";
import { Typography } from "../../../../ui/components/typography/Typography";
import type { IModFileInfo, IModRequirementExt } from "../../types";

export const ModRequirement = ({
  mod,
  modFiles,
  showPremiumBadge = false,
  onShowVortexModal,
  onConfirmInstall,
}: {
  mod: IModRequirementExt;
  modFiles?: IModFileInfo[];
  showPremiumBadge?: boolean;
  onShowVortexModal?: (file?: IModFileInfo) => void;
  onConfirmInstall?: () => void;
}) => {
  const { t } = useTranslation(["health_check"]);

  const previewImageSrc = modFiles?.[0]?.thumbnailUrl || "";

  return (
    <div className="space-y-2">
      <Typography appearance="moderate" as="div" className="space-y-2">
        <p className="font-semibold">{t("detail::item::missing_mod")}</p>

        {!!mod.notes && <p>{`${t("detail::item::author_note")}: ${mod.notes}`}</p>}
      </Typography>

      <div className="space-y-2 rounded-sm bg-surface-mid px-4 py-3">
        <div className="flex items-center gap-x-2">
          <div className="flex grow items-center gap-x-2">
            {!mod.externalRequirement && (
              <div className="relative flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stroke-weak bg-surface-translucent-low">
                <img alt="" className="absolute max-h-full" src={previewImageSrc} />
              </div>
            )}

            <div>
              <Typography>{mod.modName || mod.modUrl || mod.notes}</Typography>

              <Typography appearance="subdued" typographyType="body-sm">
                {t("detail::item::check_the_description")}
              </Typography>
            </div>
          </div>

          <div className="flex shrink-0 gap-x-2">
            {mod.externalRequirement ? (
              mod.modUrl ? (
                <Button
                  buttonType="tertiary"
                  filled="weak"
                  leftIconPath={mdiWeb}
                  rightIconPath={mdiOpenInNew}
                  size="sm"
                  onClick={() => window.api.shell.openUrl(mod.modUrl)}
                >
                  {t("detail::item::open_external_mod_page")}
                </Button>
              ) : null
            ) : (
              <>
                {mod.modUrl ? (
                  <Button
                    buttonType="tertiary"
                    filled="weak"
                    leftIcon={<img alt="" src="assets/images/nexus.svg" />}
                    size="sm"
                    onClick={() => window.api.shell.openUrl(mod.modUrl)}
                  >
                    {t("detail::item::open_mod_page")}
                  </Button>
                ) : null}

                <Button
                  buttonType="secondary"
                  filled="strong"
                  leftIconPath={mdiDownload}
                  rightIcon={
                    showPremiumBadge ? (
                      <span className="-m-1 flex size-5 items-center justify-center rounded-sm bg-premium-moderate text-neutral-strong">
                        <Icon className="size-4" path={mdiDiamondStone} size="none" />
                      </span>
                    ) : undefined
                  }
                  size="sm"
                  onClick={() => onShowVortexModal?.()}
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
      </div>
    </div>
  );
};
