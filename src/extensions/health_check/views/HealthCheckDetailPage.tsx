import React, { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

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
import type { IModRequirementExt, IModFileInfo } from "../types";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { getModFilesWithCache } from "../util";
import {
  getModFiles,
  isModFilesLoading,
  hiddenRequirements,
} from "../selectors";
import type { IState } from "../../../types/IState";
import { unknownToError } from "../../../shared/errors";
import { log } from "../../..";
import { opn } from "../../../util/api";
import { bytesToString } from "../../../util/util";
import { setRequirementHidden } from "../actions/persistent";

const Mod = ({
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

          <div className="flex gap-x-2 shrink-0">
            {mod.externalRequirement ? (
              <Button
                buttonType="tertiary"
                filled="weak"
                size="sm"
                leftIconPath="mdiWeb"
                rightIconPath="mdiOpenInNew"
                onClick={() => opn(mod.modUrl).catch(() => null)}
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
                  onClick={() => opn(mod.modUrl).catch(() => null)}
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
              onClick={onConfirmInstall}
            >
              {t("detail::item::confirm_install")}
            </Button>
          </div>
        )}

        {!mod.externalRequirement && hasFiles && (
          <div className="space-y-2">
            <Typography appearance="moderate" typographyType="body-sm">
              Available files ({modFiles.length}):
            </Typography>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {modFiles.map((file) => (
                <div
                  key={file.fileId}
                  className="flex items-center justify-between px-3 py-2 rounded bg-surface-translucent-low border border-stroke-weak hover:bg-surface-translucent-mid transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-x-2">
                      <Typography className="truncate">{file.name}</Typography>
                      {file.isPrimary && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-xs bg-premium-moderate text-neutral-strong">
                          Primary
                        </span>
                      )}
                    </div>
                    <Typography
                      appearance="subdued"
                      className="truncate"
                      typographyType="body-sm"
                    >
                      v{file.version} • {file.categoryName} •{" "}
                      {bytesToString(file.size)}
                    </Typography>
                  </div>
                  <Button
                    buttonType="tertiary"
                    filled="weak"
                    leftIconPath="mdiDownload"
                    size="sm"
                    onClick={() => onDownload(mod, file)}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!mod.externalRequirement && loadingFiles && (
          <div className="flex items-center justify-center py-4">
            <Typography appearance="subdued" typographyType="body-sm">
              Loading available files...
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
};

interface IHealthCheckDetailPageProps {
  mod: IModRequirementExt;
  api: IExtensionApi;
  onBack: () => void;
  onRefresh?: () => void;
  onDownloadMod?: (
    mod: IModRequirementExt,
    file?: IModFileInfo,
  ) => Promise<void>;
}

function HealthCheckDetailPage({
  mod,
  api,
  onBack,
  onRefresh,
  onDownloadMod,
}: IHealthCheckDetailPageProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [givenFeedBack, setGivenFeedBack] = useState(false);

  // Get mod files from Redux cache
  const modFiles = useSelector((state: IState) =>
    getModFiles(state, mod.modId),
  );
  const loading = useSelector((state: IState) =>
    isModFilesLoading(state, mod.modId),
  );

  const isPremium = useSelector(
    (state: IState) =>
      state.persistent?.["nexus"]?.userInfo?.isPremium ?? false,
  );

  // Check if this requirement is currently hidden
  const hiddenReqsMap = useSelector(hiddenRequirements);
  const isHidden = React.useMemo(() => {
    const hiddenReqs = hiddenReqsMap[mod.requiredBy.modId] || [];
    return hiddenReqs.includes(mod.id);
  }, [hiddenReqsMap, mod.requiredBy.modId, mod.id]);

  // Fetch mod files when component mounts using the requirement's gameId
  useEffect(() => {
    if (mod.externalRequirement) {
      return;
    }
    getModFilesWithCache(api, mod.gameId, mod.modId).catch((err) => {
      log("error", "Failed to fetch mod files:", unknownToError(err));
    });
  }, [api, mod.gameId, mod.modId]);

  // Memoized callback for opening the requiring mod's page
  const openRequiringModPage = React.useCallback(() => {
    if (!mod.requiredBy.modUrl) {
      return;
    }
    opn(mod.requiredBy.modUrl).catch(() => null);
  }, [mod.requiredBy.modUrl]);

  // Memoized callback for premium modal download action
  const handleDownload = React.useCallback(async () => {
    setShowPremiumModal(false);
    if (isPremium) {
      // Download and install the mod
      await onDownloadMod?.(mod);
      // Navigate back to main page
      onBack();
      // Manually trigger a refresh to ensure health check updates
      // Small delay to ensure mod is fully enabled before refresh
      setTimeout(() => {
        onRefresh?.();
      }, 1000);
    } else {
      setShowPremiumModal(true);
    }
  }, [onDownloadMod, mod, isPremium, onBack, onRefresh]);

  // Memoized callback for feedback modal success
  const handleFeedbackSuccess = React.useCallback(() => {
    setGivenFeedBack(true);
    setShowFeedbackModal(false);
  }, []);

  // Memoized callback for toggling hide/unhide state
  const handleToggleHide = React.useCallback(() => {
    // Toggle the hidden state
    api.store?.dispatch(
      setRequirementHidden(mod.requiredBy.modId, mod.id, !isHidden),
    );
    // Navigate back to the main health check page
    onBack();
  }, [api.store, mod.requiredBy.modId, mod.id, isHidden, onBack]);

  // Memoized callback for confirming external requirement installation
  const handleConfirmInstall = React.useCallback(() => {
    // Hide this requirement from future checks
    api.store?.dispatch(
      setRequirementHidden(mod.requiredBy.modId, mod.id, true),
    );
    // Navigate back to the main health check page
    onBack();
  }, [api.store, mod.requiredBy.modId, mod.id, onBack]);

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
                      modName: mod.requiredBy.modName,
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
                            onClick={openRequiringModPage}
                          />
                        ),
                      }}
                      values={{ modName: mod.requiredBy.modName }}
                    />
                  </Typography>
                </div>

                <div className="shrink-0">
                  <Button
                    buttonType="tertiary"
                    filled="weak"
                    leftIconPath={isHidden ? "mdiEye" : "mdiEyeOff"}
                    size="sm"
                    title={isHidden ? t("common:::unhide") : t("common:::hide")}
                    onClick={handleToggleHide}
                  />
                </div>
              </div>

              <Mod
                key={`${mod.modId}`}
                mod={mod}
                modFiles={modFiles}
                loadingFiles={loading}
                onShowVortexModal={() => setShowPremiumModal(true)}
                onDownload={handleDownload}
                onConfirmInstall={handleConfirmInstall}
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
        onDownload={handleDownload}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSuccess={handleFeedbackSuccess}
      />
    </MainPage>
  );
}

export default HealthCheckDetailPage;
