import {
  mdiArrowLeft,
  mdiDownload,
  mdiEye,
  mdiEyeOff,
  mdiOpenInNew,
  mdiThumbDown,
  mdiThumbUp,
} from "@mdi/js";
import { unknownToError } from "@vortex/shared";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { PremiumBanner } from "@/extensions/health_check/components/premium_banner/PremiumBanner";
import {
  getIssueMessageKey,
  getMockIssueType,
  issueTypeSeverityMap,
} from "@/extensions/health_check/utils/issueMessages";
import { severityStyleMap } from "@/extensions/health_check/utils/severityStyles";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Pictogram } from "@/ui/components/pictogram/Pictogram";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { joinClasses } from "@/ui/utils/joinClasses";
import { log } from "@/util/log";
import { shouldShowPremiumAd } from "@/util/selectors";
import MainPage from "@/views/MainPage";

import { HealthCheckFeedbackEvent } from "../../analytics/mixpanel/MixpanelEvents";
import { setRequirementHidden, setFeedbackGiven } from "../actions/persistent";
import { FeedbackModal } from "../components/feedback_modal/FeedbackModal";
import {
  FileRequirement,
  type IFileRequirementData,
} from "../components/file_requirement/FileRequirement";
import { PremiumModal } from "../components/premium_modal/PremiumModal";
import { getModFiles, hiddenRequirements, feedbackGivenMap } from "../selectors";
import type { IModRequirementExt, IModFileInfo } from "../types";
import { getModFilesWithCache } from "../utils/modFiles";

interface IHealthCheckDetailPageProps {
  mod: IModRequirementExt;
  api: IExtensionApi;
  onBack: () => void;
  onDownloadMod?: (mod: IModRequirementExt, file?: IModFileInfo) => Promise<void>;
}

// todo delete this
const makeMockFile = (): IFileRequirementData => ({
  adultContent: Math.random() < 0.5,
  modName: "Skyrim Script Extender (SKSE64)",
  modDescription:
    "The Skyrim Script Extender (SKSE) is a tool used by many Skyrim mods that expands scripting capabilities and adds additional functionality to the game.",
  modImageSrc:
    "https://staticdelivery.nexusmods.com/mods/4187/images/thumbnails/17159/17159-1779372363-780794936.png",
  fileName: "Skyrim Script Extender (SKSE64) the super long mod name version used to test GOG",
  fileVersion: "v1.0.0",
});

function HealthCheckDetailPage({ mod, api, onBack, onDownloadMod }: IHealthCheckDetailPageProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  // null = closed; otherwise the scope of the download that triggered the modal
  // (plus the file to install for the "single" scope)
  const [premiumModalScope, setPremiumModalScope] = useState<{
    scope: "single" | "all";
    file?: IModFileInfo;
  } | null>(null);

  // Check if feedback was already given for this requirement (persisted)
  const feedbackMap = useSelector(feedbackGivenMap);
  const givenFeedBack = React.useMemo(() => {
    const given = feedbackMap[mod.requiredBy.modId] || [];
    return given.includes(mod.id);
  }, [feedbackMap, mod.requiredBy.modId, mod.id]);

  // Get mod files from Redux cache
  const modFiles = useSelector((state: IState) => getModFiles(state, mod.modId));

  const showPremiumAd = useSelector(shouldShowPremiumAd);

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

  // Memoized callback for premium modal download action
  const handleDownload = React.useCallback(
    async (file?: IModFileInfo) => {
      setPremiumModalScope(null);
      if (!showPremiumAd) {
        await onDownloadMod?.(mod, file);
        onBack();
        // Health check list is refreshed automatically by the debounced
        // did-install-mod / did-enable-mods triggers in api/triggers.ts
      }
    },
    [onDownloadMod, mod, showPremiumAd, onBack],
  );

  // Memoized callback for positive feedback (thumbs up)
  const handlePositiveFeedback = React.useCallback(() => {
    api.store?.dispatch(setFeedbackGiven(mod.requiredBy.modId, mod.id));
    api.events.emit(
      "analytics-track-mixpanel-event",
      new HealthCheckFeedbackEvent("positive", mod.gameId, mod.modId, mod.requiredBy.modId),
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
    api.store?.dispatch(setRequirementHidden(mod.requiredBy.modId, mod.id, !isHidden));
    // Navigate back to the main health check page
    onBack();
  }, [api.store, mod.requiredBy.modId, mod.id, isHidden, onBack]);

  // todo delete this — one mock file per requirement so each rolls its own values
  const mockSingle = React.useMemo(makeMockFile, []);
  const mockOrA = React.useMemo(makeMockFile, []);
  const mockOrB = React.useMemo(makeMockFile, []);
  const mockCurrent = React.useMemo(makeMockFile, []);
  const mockRequired = React.useMemo(makeMockFile, []);

  // todo replace with the issue type derived from the requirement/issue data
  const issueType = React.useMemo(getMockIssueType, []);
  const severity = issueTypeSeverityMap[issueType];
  const severityStyle = severityStyleMap[severity];

  // todo derive from real data: true if any requirement group is an "or" choice
  const hasOrs = true;

  return (
    <MainPage id="health-check-detail-page">
      <MainPage.Body>
        <div className="h-full space-y-6 overflow-y-auto p-6">
          <div className="flex items-center justify-between gap-x-6">
            <div className="flex grow items-center gap-x-2">
              <Pictogram name="health-check" size="sm" />

              <div className="grow">
                <div className="flex items-center gap-x-1.5">
                  <Typography as="h2" typographyType="heading-xs">
                    {t(`detail::title::${severity}`)}
                  </Typography>

                  <Typography
                    as="div"
                    className="justity-center flex min-h-4 items-center rounded-sm border border-neutral-strong px-1"
                    typographyType="title-xs"
                  >
                    {t("common:::beta")}
                  </Typography>
                </div>

                <Typography appearance="moderate">{t(`detail::subtitle::${severity}`)}</Typography>
              </div>
            </div>

            <Button brand="neutral" appearance="moderate" leftIconPath={mdiArrowLeft} size="sm" onClick={onBack}>
              {t("common:::back")}
            </Button>
          </div>

          <div className="rounded-lg border border-stroke-weak">
            <div className="flex min-w-0 items-center gap-x-2 border-b border-stroke-weak p-3">
              <Icon
                className={joinClasses(["shrink-0", severityStyle.textClassName])}
                path={severityStyle.iconPath}
              />

              <Typography className="flex min-w-0 grow gap-x-1 font-semibold">
                <span className="shrink-0">{`${t(getIssueMessageKey(issueType))} `}</span>

                {/* todo this link to the mod within vortex */}
                <TypographyLink
                  className="block truncate"
                  typographyType="inherit"
                  variant="secondary"
                  onClick={() => console.log("todo")}
                >
                  Apothecary - Lighter Potions and Poisons
                </TypographyLink>
              </Typography>

              <Typography appearance="subdued" className="shrink-0" typographyType="body-sm">
                {t(`detail::was_this_helpful::${severity}`)}
              </Typography>

              <Button
                brand="neutral"
                appearance="moderate"
                disabled={givenFeedBack}
                leftIconPath={mdiThumbUp}
                size="sm"
                title={t("common:::helpful")}
                onClick={handlePositiveFeedback}
              />

              <Button
                brand="neutral"
                appearance="moderate"
                disabled={givenFeedBack}
                leftIconPath={mdiThumbDown}
                size="sm"
                title={t("common:::not_helpful")}
                onClick={() => setShowFeedbackModal(true)}
              />

              <div className="w-px self-stretch bg-stroke-weak" />

              <Button
                brand="neutral"
                appearance="moderate"
                leftIconPath={isHidden ? mdiEye : mdiEyeOff}
                size="sm"
                title={isHidden ? t("common:::unhide") : t("common:::hide")}
                onClick={handleToggleHide}
              />
            </div>

            <div className="p-6">
              <div className="mb-4 flex items-center justify-between gap-x-6">
                <Typography appearance="subdued">
                  {t("detail::item::requires_files", { count: modFiles.length })}
                </Typography>

                {!hasOrs && (
                  <Button
                    brand="neutral"
                    appearance="strong"
                    leftIconPath={mdiDownload}
                    rightIcon={showPremiumAd && <PremiumBadge />}
                    size="sm"
                    onClick={() => {
                      if (showPremiumAd) {
                        setPremiumModalScope({ scope: "all" });
                        return;
                      }

                      // todo download all files
                    }}
                  >
                    {t("actions::install_all", { count: 2 })}
                  </Button>
                )}
              </div>

              <div className="space-y-6">
                {/* single file requirements */}
                <FileRequirement
                  actions={
                    <>
                      <Button
                        brand="neutral"
                        appearance="moderate"
                        leftIconPath={mdiOpenInNew}
                        size="sm"
                        onClick={() => console.log("todo")}
                      >
                        {t("detail::item::install_via_mod_page")}
                      </Button>

                      {/* Emphasize the download button when "or" choices exist, since there's no "download all" option to fall back on. */}
                      <Button
                        brand="neutral"
                        appearance={hasOrs ? "strong" : "moderate"}
                        leftIconPath={mdiDownload}
                        rightIcon={showPremiumAd && <PremiumBadge />}
                        size="sm"
                        onClick={() => {
                          if (showPremiumAd) {
                            // todo pass the real IModFileInfo once the data source is wired up, take into account premium status
                            setPremiumModalScope({
                              scope: "single",
                              file: mockSingle as unknown as IModFileInfo,
                            });

                            return;
                          }

                          // todo download the file
                        }}
                      >
                        {t("detail::item::install_one_click")}
                      </Button>
                    </>
                  }
                  file={mockSingle}
                />

                {/* or file requirements */}
                {/* todo this if logic can be removed, just used for mocking UI */}
                {hasOrs && (
                  <div>
                    <Typography
                      appearance="moderate"
                      className="rounded-t-lg bg-surface-mid px-3 py-2 font-semibold"
                      brand="neutral-translucent"
                    >
                      Pick one of these
                    </Typography>

                    <div className="rounded-b-lg border-x border-b border-stroke-weak p-3">
                      <FileRequirement
                        actions={
                          <>
                            <Button
                              brand="neutral"
                              appearance="moderate"
                              leftIconPath={mdiOpenInNew}
                              size="sm"
                              onClick={() => console.log("todo")}
                            >
                              {t("detail::item::install_via_mod_page")}
                            </Button>

                            <Button
                              brand="neutral"
                              appearance="strong"
                              leftIconPath={mdiDownload}
                              rightIcon={showPremiumAd && <PremiumBadge />}
                              size="sm"
                              onClick={() => {
                                if (showPremiumAd) {
                                  // todo pass the real IModFileInfo once the data source is wired up, take into account premium status
                                  setPremiumModalScope({
                                    scope: "single",
                                    file: mockOrA as unknown as IModFileInfo,
                                  });

                                  return;
                                }

                                // todo download the file
                              }}
                            >
                              {t("detail::item::install_one_click")}
                            </Button>
                          </>
                        }
                        file={mockOrA}
                        isOr={true}
                      />

                      <FileRequirement
                        actions={
                          <>
                            <Button
                              brand="neutral"
                              appearance="moderate"
                              leftIconPath={mdiOpenInNew}
                              size="sm"
                              onClick={() => console.log("todo")}
                            >
                              {t("detail::item::install_via_mod_page")}
                            </Button>

                            <Button
                              brand="neutral"
                              appearance="strong"
                              leftIconPath={mdiDownload}
                              rightIcon={showPremiumAd && <PremiumBadge />}
                              size="sm"
                              onClick={() => {
                                if (showPremiumAd) {
                                  // todo pass the real IModFileInfo once the data source is wired up, take into account premium status
                                  setPremiumModalScope({
                                    scope: "single",
                                    file: mockOrB as unknown as IModFileInfo,
                                  });

                                  return;
                                }

                                // todo download the file
                              }}
                            >
                              {t("detail::item::install_one_click")}
                            </Button>
                          </>
                        }
                        file={mockOrB}
                        isOr={true}
                      />
                    </div>
                  </div>
                )}

                {/* requires a different version */}
                <div>
                  <Typography appearance="subdued">
                    Requires installing a different version of an existing mod file. Only one
                    version can be enabled at a time.
                  </Typography>

                  <Typography appearance="subdued" className="mt-1 mb-2">
                    Currently enabled version:
                  </Typography>

                  <FileRequirement
                    actions={
                      <Button brand="neutral" appearance="moderate" size="sm" onClick={() => console.log("todo")}>
                        View in loadout
                      </Button>
                    }
                    file={mockCurrent}
                  />

                  <Typography appearance="subdued" className="mt-4 mb-2">
                    Required version:
                  </Typography>

                  <FileRequirement
                    actions={
                      <>
                        <Button
                          brand="neutral"
                          appearance="moderate"
                          leftIconPath={mdiOpenInNew}
                          size="sm"
                          onClick={() => console.log("todo")}
                        >
                          {t("detail::item::install_via_mod_page")}
                        </Button>

                        <Button
                          brand="neutral"
                          appearance={hasOrs ? "strong" : "moderate"}
                          leftIconPath={mdiDownload}
                          rightIcon={showPremiumAd && <PremiumBadge />}
                          size="sm"
                          onClick={() => {
                            if (showPremiumAd) {
                              // todo pass the real IModFileInfo once the data source is wired up, take into account premium status
                              setPremiumModalScope({
                                scope: "single",
                                file: mockRequired as unknown as IModFileInfo,
                              });

                              return;
                            }

                            // todo download the file
                          }}
                        >
                          {t("detail::item::install_one_click")}
                        </Button>
                      </>
                    }
                    file={mockRequired}
                  />
                </div>
              </div>
            </div>
          </div>

          <PremiumBanner />
        </div>
      </MainPage.Body>

      <PremiumModal
        downloadScope={premiumModalScope?.scope ?? "single"}
        isOpen={premiumModalScope !== null}
        onClose={() => setPremiumModalScope(null)}
        onDownload={() => {
          {
            /* todo the download action changes if single or all scope is set */
          }
          void handleDownload(premiumModalScope?.file);
        }}
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
