import {
  mdiCheck,
  mdiDownload,
  mdiEye,
  mdiEyeOff,
  mdiOpenInNew,
  mdiThumbDown,
  mdiThumbUp,
} from "@mdi/js";
import { unknownToError } from "@vortex/shared";
import React, { useCallback, useEffect, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { getModFilesWithCache } from "@/extensions/health_check/utils/modRequirements/modFiles";
import { log } from "@/logging";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { opn } from "@/util/api";

import { setModRequirementHidden } from "../../actions/persistent";
import { MOD_REQUIREMENTS_CHECK_ID } from "../../checks/modRequirementsCheck";
import { FeedbackModal } from "../../components/feedback_modal/FeedbackModal";
import {
  FileRequirement,
  type IFileRequirementData,
} from "../../components/file_requirement/FileRequirement";
import { ModRequirement } from "../../components/mod_requirement/ModRequirement";
import { useModRequirementActions } from "../../components/mod_requirement/useModRequirementActions";
import { PremiumModal } from "../../components/premium_modal/PremiumModal";
import { allModRequirements, getModFiles, hiddenModRequirements } from "../../selectors";
import type { IModRequirementExt } from "../../types";
import type { IDetailViewProps, IHealthCheckContent, IListingRowProps } from "./types";

function isModHidden(
  state: Parameters<typeof hiddenModRequirements>[0],
  mod: IModRequirementExt,
): boolean {
  return (hiddenModRequirements(state)[mod.requiredBy.modId] || []).includes(mod.id);
}

function ModRequirementsListingRow({
  api,
  entry,
  isHidden,
  onOpen,
  onToggleHide,
}: IListingRowProps) {
  return (
    <ModRequirement
      api={api}
      isHidden={isHidden}
      requirementInfo={entry.data as IModRequirementExt}
      severity={entry.severity}
      onClick={onOpen}
      onToggleHide={onToggleHide}
    />
  );
}

/**
 * Detail view for a single missing mod requirement. Mirrors the standalone
 * health-check detail page that shipped on master, in Rich's new card design:
 * install (premium-gated for free users), open mod page, external-requirement
 * confirmation, author notes, thumbs feedback, and hide. Install/feedback logic
 * is shared with the listing row via useModRequirementActions.
 */
function ModRequirementsDetailView({ entry, api, onBack }: IDetailViewProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const mod = entry.data as IModRequirementExt;

  const {
    givenFeedback,
    showPremiumAd,
    showFeedbackModal,
    setShowFeedbackModal,
    showPremiumModal,
    setShowPremiumModal,
    openModPage,
    installInApp,
    handlePositiveFeedback,
    handleFeedbackSuccess,
  } = useModRequirementActions(api, mod, onBack);

  const modFiles = useSelector((state: IState) => getModFiles(state, mod.modId));

  const hiddenRequirementMap = useSelector(hiddenModRequirements);
  const isHidden = useMemo(
    () => (hiddenRequirementMap[mod.requiredBy.modId] ?? []).includes(mod.id),
    [hiddenRequirementMap, mod.requiredBy.modId, mod.id],
  );

  // Fetch the required mod's files for the preview/version; skipped for external
  // requirements, which have no Nexus files.
  useEffect(() => {
    if (mod.externalRequirement) {
      return;
    }
    getModFilesWithCache(api, mod.gameId, mod.modId).catch((err: unknown) => {
      log("warn", "health check: failed to fetch requirement mod files", unknownToError(err));
    });
  }, [api, mod.gameId, mod.modId, mod.externalRequirement]);

  const openRequiringModPage = useCallback(() => {
    if (mod.requiredBy.modUrl) {
      opn(mod.requiredBy.modUrl).catch(() => undefined);
    }
  }, [mod.requiredBy.modUrl]);

  const handleToggleHide = useCallback(() => {
    api.store?.dispatch(setModRequirementHidden(mod.requiredBy.modId, mod.id, !isHidden));
    onBack();
  }, [api, mod.requiredBy.modId, mod.id, isHidden, onBack]);

  // External installs can't be auto-detected, so confirming just hides the
  // requirement from future checks.
  const handleConfirmInstall = useCallback(() => {
    api.store?.dispatch(setModRequirementHidden(mod.requiredBy.modId, mod.id, true));
    onBack();
  }, [api, mod.requiredBy.modId, mod.id, onBack]);

  const mainFile = modFiles?.[0];
  const fileData: IFileRequirementData = {
    fileUID: mod.uid,
    adultContent: false,
    modName: mod.modName || mod.modUrl || mod.notes || "",
    modDescription: mod.notes || t("detail::item::check_the_description"),
    modImageSrc: mainFile?.thumbnailUrl ?? "",
    fileName: mainFile?.name ?? "",
    fileVersion: mainFile?.version ?? "",
    installed: false,
    enabled: false,
  };

  const actions = mod.externalRequirement ? (
    mod.modUrl ? (
      <Button
        appearance="moderate"
        brand="neutral"
        leftIconPath={mdiOpenInNew}
        size="sm"
        onClick={openModPage}
      >
        {t("detail::item::open_external_mod_page")}
      </Button>
    ) : null
  ) : (
    <>
      {mod.modUrl ? (
        <Button
          appearance="moderate"
          brand="neutral"
          leftIconPath={mdiOpenInNew}
          size="sm"
          onClick={openModPage}
        >
          {t("detail::item::install_via_mod_page")}
        </Button>
      ) : null}

      <Button
        appearance="strong"
        brand="neutral"
        leftIconPath={mdiDownload}
        rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
        size="sm"
        onClick={() => void installInApp()}
      >
        {t("detail::item::install_one_click")}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-x-4">
        <div className="min-w-0">
          <Typography className="font-semibold">
            {t("detail::item::title", { modName: mod.requiredBy.modName })}
          </Typography>

          <Typography appearance="moderate">
            <Trans
              components={{
                modLink: (
                  <TypographyLink
                    brand="primary"
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

        <div className="flex shrink-0 items-center gap-x-2">
          <Typography appearance="subdued" typographyType="body-sm">
            {givenFeedback
              ? t("common:::thanks_for_your_feedback")
              : t(`detail::was_this_helpful::${entry.severity}`)}
          </Typography>

          <Button
            appearance="moderate"
            brand="neutral"
            disabled={givenFeedback}
            leftIconPath={mdiThumbUp}
            size="sm"
            title={t("common:::helpful")}
            onClick={handlePositiveFeedback}
          />

          <Button
            appearance="moderate"
            brand="neutral"
            disabled={givenFeedback}
            leftIconPath={mdiThumbDown}
            size="sm"
            title={t("common:::not_helpful")}
            onClick={() => setShowFeedbackModal(true)}
          />

          <Button
            appearance="moderate"
            brand="neutral"
            leftIconPath={isHidden ? mdiEye : mdiEyeOff}
            size="sm"
            title={isHidden ? t("common:::unhide") : t("common:::hide")}
            onClick={handleToggleHide}
          />
        </div>
      </div>

      <FileRequirement actions={actions} file={fileData} />

      {mod.externalRequirement && (
        <div className="flex items-center gap-x-3 rounded-sm bg-info-weak/20 p-3">
          <Typography appearance="moderate" as="div" className="grow" typographyType="body-sm">
            {t("detail::item::after_installing")}
          </Typography>

          <Button
            appearance="moderate"
            brand="neutral"
            leftIconPath={mdiCheck}
            size="sm"
            onClick={handleConfirmInstall}
          >
            {t("detail::item::confirm_install")}
          </Button>
        </div>
      )}

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onDownload={() => {
          setShowPremiumModal(false);
          openModPage();
        }}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSuccess={handleFeedbackSuccess}
      />
    </div>
  );
}

export const modRequirementsContent: IHealthCheckContent = {
  selectEntries: (state) =>
    allModRequirements(state).map((mod) => ({
      id: `${mod.requiredBy.modId}-${mod.uid || `${mod.gameId}-${mod.modId || mod.modName}`}`,
      checkId: MOD_REQUIREMENTS_CHECK_ID,
      severity: "suggestion",
      data: mod,
    })),
  ListingRow: ModRequirementsListingRow,
  DetailView: ModRequirementsDetailView,
  supportsHide: true,
  isHidden: (state, entry) => isModHidden(state, entry.data as IModRequirementExt),
  toggleHide: (api, entry) => {
    const mod = entry.data as IModRequirementExt;
    const hidden = isModHidden(api.getState(), mod);
    api.store?.dispatch(setModRequirementHidden(mod.requiredBy.modId, mod.id, !hidden));
  },
};
