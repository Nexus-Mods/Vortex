import * as React from "react";
import { Trans, useTranslation } from "react-i18next";

import MainPage from "../../../renderer/views/MainPage";
import { Button } from "../../../tailwind/components/next/button";
import {
  Typography,
  TypographyLink,
} from "../../../tailwind/components/next/typography";
import { Icon } from "../../../tailwind/components/next/icon";
import { Pictogram } from "../../../tailwind/components/pictogram";
import { NexusMods } from "../../../tailwind/components/icons/NexusMods";

const Mod = ({
  children,
  isExternal,
  modName,
}: React.PropsWithChildren<{ isExternal?: boolean; modName: string }>) => (
  <div className="bg-surface-mid space-y-2 px-4 py-3 rounded">
    <div className="flex gap-x-2 items-center">
      <div className="grow">
        <Typography>{modName}</Typography>

        <Typography
          appearance="subdued"
          className="whitespace-pre-line"
          typographyType="body-sm"
        >
          {children}
        </Typography>
      </div>

      <div className="flex gap-x-2 shrink-0">
        {isExternal ? (
          <Button
            buttonType="tertiary"
            filled="weak"
            size="sm"
            leftIconPath="mdiWeb"
            rightIconPath="mdiOpenInNew"
          >
            Open external mod page
          </Button>
        ) : (
          <>
            <Button
              buttonType="tertiary"
              filled="weak"
              size="sm"
              leftIcon={NexusMods}
            >
              Open mod page
            </Button>

            <Button
              buttonType="secondary"
              filled="strong"
              size="sm"
              leftIconPath="mdiDownload"
              rightIcon={
                <span className="flex items-center justify-center size-5 text-neutral-strong bg-premium-moderate rounded -m-1">
                  <Icon className="size-4" path="mdiDiamondStone" size="none" />
                </span>
              }
            >
              Install in app
            </Button>
          </>
        )}
      </div>
    </div>

    {isExternal && (
      <div className="rounded p-3 flex items-center bg-info-weak/20">
        <Typography
          as="div"
          appearance="none"
          className="grow text-info-strong"
          typographyType="body-sm"
        >
          After installing, click Confirm install. We can’t automatically detect
          external mod installations.
        </Typography>

        <Button
          buttonType="tertiary"
          filled="weak"
          leftIconPath="mdiCheck"
          size="sm"
        >
          Confirm install
        </Button>
      </div>
    )}
  </div>
);

function HealthCheckDetailPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation(["health_check", "common"]);

  return (
    <MainPage id="health-check-detail-page">
      <MainPage.Body>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center gap-x-6">
            <div className="grow flex gap-x-2 items-center">
              <Pictogram name="health-check" size="sm" />

              <div className="grow">
                <div className="flex items-center gap-x-1.5">
                  <Typography
                    as="h2"
                    className="m-0"
                    typographyType="heading-xs"
                  >
                    {t("detail::title")}
                  </Typography>

                  <Typography
                    as="div"
                    className="leading-4 rounded border border-neutral-strong flex items-center justity-center px-1 min-h-4"
                    typographyType="title-xs"
                  >
                    {t("common:::beta")}
                  </Typography>
                </div>

                <Typography appearance="moderate">
                  {t("detail::subtitle")}
                </Typography>
              </div>
            </div>

            <div>
              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath="mdiArrowLeft"
                size="sm"
                onClick={onBack}
              >
                {t("common:::view_all")}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded bg-linear-to-r from-premium-moderate/25 via-premium-moderate/10 to-premium-moderate/25 py-3 px-4 gap-x-6 shadow-xs mb-4 border border-premium-moderate/23">
            <div className="flex items-center gap-x-1.5">
              <Icon
                className="text-netural-strong shrink-0"
                path="mdiLightningBolt"
              />

              <div className="flex gap-x-2 items-center grow">
                <Typography className="font-semibold">
                  {t("premium_banner::title")}
                </Typography>

                <Typography appearance="none" className="text-premium-strong">
                  {t("premium_banner::subtitle")}
                </Typography>
              </div>
            </div>

            <Button buttonType="premium" size="sm">
              {t("premium_banner::button")}
            </Button>
          </div>

          <div className="flex items-start gap-x-3 border border-stroke-weak p-6 rounded-lg">
            <Icon
              className="mt-0.5 text-info-strong shrink-0"
              path="mdiAlertCircle"
            />

            <div className="grow space-y-4">
              <div className="flex gap-x-3">
                <div className="grow">
                  <Typography className="font-semibold">
                    {t("detail::item::title", {
                      modName: "Sprint Swim Redux SKSE or Longer mod name",
                    })}
                  </Typography>

                  <Typography appearance="moderate">
                    <Trans
                      i18nKey="detail::item::description"
                      ns="health_check"
                      components={{
                        modLink: (
                          <TypographyLink
                            as="button"
                            appearance="primary"
                            typographyType="inherit"
                            variant="secondary"
                            onClick={() => alert("to go mod page")}
                          />
                        ),
                      }}
                      values={{ modName: "Sprint Swim Redux SKSE" }}
                    />
                  </Typography>
                </div>

                <div className="shrink-0">
                  <Button
                    buttonType="tertiary"
                    filled="weak"
                    leftIconPath="mdiEyeOff"
                    size="sm"
                    title={t("common:::hide")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Mod modName="Address Library for SKSE Plugins">
                  Check the description before installing.
                </Mod>

                <Mod
                  isExternal={true}
                  modName="Name of external mod with author note"
                >
                  {`This mod is hosted outside Nexus Mods. Check the description before installing.\n\nNote from mod author:\nSelect the 2nd link down.`}
                </Mod>
              </div>
            </div>
          </div>

          <div className="flex gap-x-3 items-center justify-end">
            <Typography appearance="subdued">
              {t("detail::was_this_suggestion_helpful")}
            </Typography>

            <div className="flex gap-x-2 shrink-0">
              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath="mdiThumbUp"
                size="sm"
                title={t("common:::helpful")}
              />

              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath="mdiThumbDown"
                size="sm"
                title={t("common:::not_helpful")}
              />
            </div>
          </div>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckDetailPage;
