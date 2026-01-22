import React, { useState } from "react";
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
import { PremiumModal } from "../components/premium_modal";
import { FeedbackModal } from "../components/feedback_modal";
import type { IModRequirementExt } from "../types";

const Mod = ({
  mod,
  onShowVortexModal,
}: {
  mod: IModRequirementExt;
  onShowVortexModal?: () => void;
}) => {
  const { t } = useTranslation(["health_check"]);

  return (
    <div className="space-y-2">
      <Typography as="div" appearance="moderate" className="space-y-2">
        <p className="font-semibold">{t("detail::item::missing_mod")}</p>

        {!!mod.notes && (
          <p>
            {t("detail::item::author_note")}: {mod.notes}
          </p>
        )}
      </Typography>

      <div className="bg-surface-mid space-y-2 px-4 py-3 rounded">
        <div className="flex gap-x-2 items-center">
          <div className="flex items-center gap-x-2 grow">
            <div className="relative w-16 shrink-0 flex items-center justify-center overflow-hidden aspect-video bg-surface-translucent-low border border-stroke-weak rounded-md">
              {/* todo update src to use correct mod image */}
              <img
                alt=""
                className="absolute max-h-full"
                src="https://staticdelivery.nexusmods.com/mods/1303/images/thumbnails/2400/2400-1739896414-1995424095.png"
              />
            </div>

            <div>
              <Typography>{mod.modName}</Typography>

              <Typography appearance="subdued" typographyType="body-sm">
                {t("detail::item::check_the_description")}
              </Typography>
            </div>
          </div>

          <div className="flex gap-x-2 shrink-0">
            {mod.externalRequirement ? (
              <Button
                buttonType="tertiary"
                filled="weak"
                size="sm"
                leftIconPath="mdiWeb"
                rightIconPath="mdiOpenInNew"
              >
                {t("detail::item::open_external_mod_page")}
              </Button>
            ) : (
              <>
                <Button
                  buttonType="tertiary"
                  filled="weak"
                  size="sm"
                  leftIcon={NexusMods}
                >
                  {t("detail::item::open_mod_page")}
                </Button>

                <Button
                  buttonType="secondary"
                  filled="strong"
                  size="sm"
                  leftIconPath="mdiDownload"
                  rightIcon={
                    <span className="flex items-center justify-center size-5 text-neutral-strong bg-premium-moderate rounded -m-1">
                      <Icon
                        className="size-4"
                        path="mdiDiamondStone"
                        size="none"
                      />
                    </span>
                  }
                  onClick={onShowVortexModal}
                >
                  {t("detail::item::install_in_app")}
                </Button>
              </>
            )}
          </div>
        </div>

        {mod.externalRequirement && (
          <div className="rounded p-3 flex items-center bg-info-weak/20">
            <Typography
              as="div"
              appearance="none"
              className="grow text-info-strong"
              typographyType="body-sm"
            >
              {t("detail::item::after_installing")}
            </Typography>

            <Button
              buttonType="tertiary"
              filled="weak"
              leftIconPath="mdiCheck"
              size="sm"
            >
              {t("detail::item::confirm_install")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

interface IHealthCheckDetailPageProps {
  mod: IModRequirementExt;
  onBack: () => void;
}

function HealthCheckDetailPage({ mod, onBack }: IHealthCheckDetailPageProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [givenFeedBack, setGivenFeedBack] = useState(false);

  return (
    <MainPage id="health-check-detail-page">
      <MainPage.Body>
        <div className="p-6 space-y-6 max-w-5xl">
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
                  {t("premium::banner::title")}
                </Typography>

                <Typography appearance="none" className="text-premium-strong">
                  {t("premium::banner::subtitle")}
                </Typography>
              </div>
            </div>

            <Button buttonType="premium" size="sm">
              {t("premium::banner::button")}
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
                      modName: mod.modName,
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
                      values={{ modName: mod.modName }}
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

              <Mod
                key={`${mod.modId}`}
                mod={mod}
                onShowVortexModal={() => setShowPremiumModal(true)}
              />
            </div>
          </div>

          <div className="flex gap-x-3 items-center justify-end">
            <Typography appearance="subdued">
              {givenFeedBack
                ? t("common:::thanks_for_your_feedback")
                : t("common:::was_this_helpful")}
            </Typography>

            <div className="flex gap-x-2 shrink-0">
              <Button
                buttonType="tertiary"
                disabled={givenFeedBack}
                filled="weak"
                leftIconPath="mdiThumbUp"
                size="sm"
                title={t("common:::helpful")}
                onClick={() => setGivenFeedBack(true)}
              />

              <Button
                buttonType="tertiary"
                disabled={givenFeedBack}
                filled="weak"
                leftIconPath="mdiThumbDown"
                size="sm"
                title={t("common:::not_helpful")}
                onClick={() => setShowFeedbackModal(true)}
              />
            </div>
          </div>
        </div>
      </MainPage.Body>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSuccess={() => {
          setGivenFeedBack(true);
          setShowFeedbackModal(false);
        }}
      />
    </MainPage>
  );
}

export default HealthCheckDetailPage;
