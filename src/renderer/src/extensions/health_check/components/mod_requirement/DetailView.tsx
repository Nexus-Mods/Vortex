import { mdiCheck, mdiDownload, mdiHelpCircleOutline, mdiOpenInNew } from "@mdi/js";
import { unknownToError } from "@vortex/shared";
import React, { useCallback, useEffect, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { getModFilesWithCache } from "@/extensions/health_check/utils/modRequirements/modFiles";
import { modToFileData } from "@/extensions/health_check/utils/modRequirements/modRequirementData";
import { severityStyleMap } from "@/extensions/health_check/utils/shared/severityStyles";
import { log } from "@/logging";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { opn } from "@/util/api";

import { setModRequirementHidden } from "../../actions/persistent";
import { useModRequirementActions } from "../../hooks/useModRequirementActions";
import { getModFiles, hiddenModRequirements } from "../../selectors";
import type { IModRequirementExt } from "../../types";
import type { IDetailViewProps } from "../../views/content/types";
import { EntryActions } from "../entry_actions/EntryActions";
import { FileRequirement } from "../file_requirement/FileRequirement";
import { PremiumModal } from "../premium_modal/PremiumModal";

export const DetailView = ({ entry, api, onBack }: IDetailViewProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const mod = entry.data as IModRequirementExt;

  const {
    givenFeedback,
    showPremiumAd,
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

  const fileData = modToFileData(mod, modFiles?.[0]);
  const severityStyle = severityStyleMap[entry.severity];

  return (
    <>
      <div className="rounded-lg border border-stroke-weak">
        <div className="flex items-center justify-between gap-x-4 border-b border-stroke-weak p-3">
          <div className="flex min-w-0 items-center gap-x-2">
            <Icon className={severityStyle.textClassName} path={severityStyle.iconPath} />

            <Typography as="div" className="font-semibold">
              {t("detail::item::title", { modName: mod.requiredBy.modName })}
            </Typography>
          </div>

          <EntryActions
            givenFeedback={givenFeedback}
            isHidden={isHidden}
            severity={entry.severity}
            variant="detail"
            onHelpful={handlePositiveFeedback}
            onNotHelpful={handleFeedbackSuccess}
            onToggleHide={handleToggleHide}
          />
        </div>

        <div className="space-y-4 pt-4 pb-6">
          <Typography appearance="subdued" as="div" className="mb-4 space-y-4 px-6">
            <p>{t("detail::item::may_require_file")}</p>

            {!!mod.notes && <p>{t("detail::item::author_note", { note: mod.notes })}</p>}
          </Typography>

          <FileRequirement
            actions={
              mod.externalRequirement ? (
                !!mod.modUrl && (
                  <Button
                    appearance="moderate"
                    brand="neutral"
                    leftIconPath={mdiOpenInNew}
                    size="sm"
                    onClick={openModPage}
                  >
                    {t("detail::item::open_external_mod_page")}
                  </Button>
                )
              ) : (
                <>
                  {!!mod.modUrl && (
                    <Button
                      appearance="moderate"
                      brand="neutral"
                      leftIconPath={mdiOpenInNew}
                      size="sm"
                      onClick={openModPage}
                    >
                      {t("detail::item::install_via_mod_page")}
                    </Button>
                  )}

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
              )
            }
            file={fileData}
          />

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
        </div>
      </div>

      <Typography
        appearance="subdued"
        as="div"
        className="flex gap-x-2 rounded-lg border border-stroke-weak px-4 py-3"
      >
        <Icon className="mt-0.5" path={mdiHelpCircleOutline} size="sm" />

        <p>
          <Trans
            components={{
              modLink: (
                <TypographyLink
                  appearance="subdued"
                  typographyType="inherit"
                  onClick={openRequiringModPage}
                />
              ),
            }}
            i18nKey="detail::item::mod_page_source_note"
            ns="health_check"
          />
        </p>
      </Typography>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onDownload={() => {
          setShowPremiumModal(false);
          openModPage();
        }}
      />
    </>
  );
};
