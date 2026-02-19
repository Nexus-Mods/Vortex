import {
  mdiAlertCircle,
  mdiArrowLeft,
  mdiEye,
  mdiEyeOff,
  mdiLightningBolt,
  mdiThumbDown,
  mdiThumbUp,
} from "@mdi/js";
import React, { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";
import type { IState } from "../../../renderer/types/IState";
import type { IModRequirementExt, IModFileInfo } from "../types";

import { log } from "../../../renderer/util/log";
import MainPage from "../../../renderer/views/MainPage";
import { unknownToError } from "../../../shared/errors";
import { Button } from "../../../renderer/ui/components/button/Button";
import { Icon } from "../../../renderer/ui/components/icon/Icon";
import {
  Typography,
  TypographyLink,
} from "../../../renderer/ui/components/typography/Typography";
import { Pictogram } from "../../../renderer/ui/components/pictogram/Pictogram";
import { opn } from "../../../renderer/util/api";
import { HealthCheckFeedbackEvent } from "../../analytics/mixpanel/MixpanelEvents";
import { setRequirementHidden, setFeedbackGiven } from "../actions/persistent";
import { FeedbackModal } from "../components/feedback_modal";
import { PremiumModal } from "../components/premium_modal";
import {
  getModFiles,
  isModFilesLoading,
  hiddenRequirements,
  feedbackGivenMap,
} from "../selectors";
import { getModFilesWithCache } from "../util";
import { ModRequirement } from "../components/mod_requirement";

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

  // Check if feedback was already given for this requirement (persisted)
  const feedbackMap = useSelector(feedbackGivenMap);
  const givenFeedBack = React.useMemo(() => {
    const given = feedbackMap[mod.requiredBy.modId] || [];
    return given.includes(mod.id);
  }, [feedbackMap, mod.requiredBy.modId, mod.id]);

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

  // Memoized callback for positive feedback (thumbs up)
  const handlePositiveFeedback = React.useCallback(() => {
    api.store?.dispatch(setFeedbackGiven(mod.requiredBy.modId, mod.id));
    api.events.emit(
      "analytics-track-mixpanel-event",
      new HealthCheckFeedbackEvent(
        "positive",
        mod.gameId,
        mod.modId,
        mod.requiredBy.modId,
      ),
    );
  }, [api, mod]);

  // Memoized callback for negative feedback (from modal)
  const handleFeedbackSuccess = React.useCallback(
    (reasons: string[]) => {
      api.store?.dispatch(setFeedbackGiven(mod.requiredBy.modId, mod.id));
      api.events.emit(
        "analytics-track-mixpanel-event",
        new HealthCheckFeedbackEvent(
          "negative",
          mod.gameId,
          mod.modId,
          mod.requiredBy.modId,
          reasons,
        ),
      );
      setShowFeedbackModal(false);
    },
    [api, mod],
  );

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
        <div className="max-w-5xl space-y-6 p-6">
          <div className="flex items-center justify-between gap-x-6">
            <div className="flex grow items-center gap-x-2">
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
                    className="justity-center flex min-h-4 items-center rounded-sm border border-neutral-strong px-1 leading-4"
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
                leftIconPath={mdiArrowLeft}
                size="sm"
                onClick={onBack}
              >
                {t("common:::view_all")}
              </Button>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between gap-x-6 rounded-sm border border-premium-moderate/23 bg-linear-to-r from-premium-moderate/25 via-premium-moderate/10 to-premium-moderate/25 px-4 py-3 shadow-xs">
            <div className="flex items-center gap-x-1.5">
              <Icon
                className="text-netural-strong shrink-0"
                path={mdiLightningBolt}
              />

              <div className="flex grow items-center gap-x-2">
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

          <div className="flex items-start gap-x-3 rounded-lg border border-stroke-weak p-6">
            <Icon
              className="mt-0.5 shrink-0 text-info-strong"
              path={mdiAlertCircle}
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
                      components={{
                        modLink: (
                          <TypographyLink
                            appearance="primary"
                            as="button"
                            typographyType="inherit"
                            variant="secondary"
                            onClick={openRequiringModPage}
                          />
                        ),
                      }}
                      i18nKey="detail::item::description"
                      ns="health_check"
                      values={{ modName: mod.requiredBy.modName }}
                    />
                  </Typography>
                </div>

                <div className="shrink-0">
                  <Button
                    buttonType="tertiary"
                    filled="weak"
                    leftIconPath={isHidden ? mdiEye : mdiEyeOff}
                    size="sm"
                    title={isHidden ? t("common:::unhide") : t("common:::hide")}
                    onClick={handleToggleHide}
                  />
                </div>
              </div>

              <ModRequirement
                key={`${mod.modId}`}
                loadingFiles={loading}
                mod={mod}
                modFiles={modFiles}
                onConfirmInstall={handleConfirmInstall}
                onDownload={handleDownload}
                onShowVortexModal={() => setShowPremiumModal(true)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-x-3">
            <Typography appearance="subdued">
              {givenFeedBack
                ? t("common:::thanks_for_your_feedback")
                : t("common:::was_this_helpful")}
            </Typography>

            <div className="flex shrink-0 gap-x-2">
              <Button
                buttonType="tertiary"
                disabled={givenFeedBack}
                filled="weak"
                leftIconPath={mdiThumbUp}
                size="sm"
                title={t("common:::helpful")}
                onClick={handlePositiveFeedback}
              />

              <Button
                buttonType="tertiary"
                disabled={givenFeedBack}
                filled="weak"
                leftIconPath={mdiThumbDown}
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
