import {
  mdiCheck,
  mdiHelpCircleOutline,
  mdiMonitorArrowDownVariant,
  mdiOpenInNew,
  mdiWeb,
} from "@mdi/js";
import React, { useCallback, useEffect, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { modToFileData } from "@/extensions/health_check/utils/modRequirements/modRequirementData";
import { severityStyleMap } from "@/extensions/health_check/utils/shared/severityStyles";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { opn } from "@/util/api";

import { setModRequirementHidden } from "../../actions/persistent";
import { useHealthCheckTracking } from "../../hooks/useHealthCheckTracking";
import { useModRequirementActions } from "../../hooks/useModRequirementActions";
import { hiddenModRequirements } from "../../selectors";
import type { IModRequirementExt } from "../../types";
import { checkNameForCheck, issueTypeForCheck } from "../../utils/shared/tracking";
import type { IDetailViewProps } from "../../views/content/types";
import { Divider } from "../divider/Divider";
import { EntryActions } from "../entry_actions/EntryActions";
import { FileRequirement } from "../file_requirement/FileRequirement";
import { PremiumModal } from "../premium_modal/PremiumModal";

export const DetailView = ({ entry, api, onBack }: IDetailViewProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const mod = entry.data as IModRequirementExt;

  const issueType = issueTypeForCheck(entry.checkId);
  const checkName = checkNameForCheck(entry.checkId);

  const {
    givenFeedback,
    showPremiumAd,
    showPremiumModal,
    setShowPremiumModal,
    openModPage,
    installInApp,
    handlePositiveFeedback,
    handleFeedbackSuccess,
  } = useModRequirementActions(api, mod, { issueId: entry.id, checkId: checkName }, onBack);

  const hiddenRequirementMap = useSelector(hiddenModRequirements);
  const isHidden = useMemo(
    () => (hiddenRequirementMap[mod.requiredBy.modId] ?? []).includes(mod.id),
    [hiddenRequirementMap, mod.requiredBy.modId, mod.id],
  );

  const {
    trackDetailViewed,
    trackOneClickInstallClicked,
    trackInstallViaModPageClicked,
    trackViewModPageClicked,
    trackSuggestionSourceLinkClicked,
    trackIssueHidden,
    trackIssueUnhidden,
  } = useHealthCheckTracking(api);
  const modVersion = mod.mainFile?.version ?? "";

  // detail_viewed fires once per detail open; entry-prop changes as the check re-runs
  // shouldn't re-fire it, so the mount-only effect is intentional.
  useEffect(() => {
    trackDetailViewed({
      issue_id: entry.id,
      check_id: checkName,
      issue_type: issueType,
      resolution_type: "install",
      required_mod_count: 1,
      source_mod_name: mod.requiredBy.modName,
    });
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, []);

  const handleInstall = () => {
    trackOneClickInstallClicked({
      issue_id: entry.id,
      check_id: checkName,
      mod_id: mod.modId,
      mod_name: mod.modName,
      mod_version: modVersion,
      is_adult_content: mod.mainFile?.adultContent ?? false,
    });

    void installInApp();
  };

  // Free users are routed to the website to install (a resolution action); premium users
  // clicking through to the mod page is informational — track them as distinct events.
  const handleModPage = () => {
    const modPageProps = {
      issue_id: entry.id,
      check_id: checkName,
      mod_id: mod.modId,
      mod_name: mod.modName,
      mod_version: modVersion,
    };

    if (showPremiumAd) {
      trackInstallViaModPageClicked(modPageProps);
    } else {
      trackViewModPageClicked(modPageProps);
    }

    openModPage();
  };

  const openRequiringModPage = useCallback(() => {
    trackSuggestionSourceLinkClicked({
      issue_id: entry.id,
      check_id: checkName,
      mod_id: mod.requiredBy.modId,
    });

    if (mod.requiredBy.modUrl) {
      opn(mod.requiredBy.modUrl).catch(() => undefined);
    }
  }, [
    trackSuggestionSourceLinkClicked,
    entry.id,
    checkName,
    mod.requiredBy.modId,
    mod.requiredBy.modUrl,
  ]);

  const handleToggleHide = useCallback(() => {
    if (isHidden) {
      trackIssueUnhidden({ issue_id: entry.id, check_id: checkName, issue_type: issueType });
    } else {
      trackIssueHidden({
        issue_id: entry.id,
        check_id: checkName,
        issue_type: issueType,
        resolution_type: "install",
      });
    }

    api.store?.dispatch(setModRequirementHidden(mod.requiredBy.modId, mod.id, !isHidden));
    onBack();
  }, [
    api,
    mod.requiredBy.modId,
    mod.id,
    isHidden,
    onBack,
    entry.id,
    checkName,
    issueType,
    trackIssueHidden,
    trackIssueUnhidden,
  ]);

  // External installs can't be auto-detected, so confirming just hides the
  // requirement from future checks.
  const handleConfirmInstall = useCallback(() => {
    api.store?.dispatch(setModRequirementHidden(mod.requiredBy.modId, mod.id, true));
    onBack();
  }, [api, mod.requiredBy.modId, mod.id, onBack]);

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
                      onClick={handleModPage}
                    >
                      {t("detail::item::install_via_mod_page")}
                    </Button>
                  )}

                  <Button
                    appearance="strong"
                    brand="neutral"
                    leftIconPath={mdiMonitorArrowDownVariant}
                    rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
                    size="sm"
                    onClick={handleInstall}
                  >
                    {t("detail::item::install_one_click")}
                  </Button>
                </>
              )
            }
            file={
              mod.externalRequirement
                ? {
                    ...modToFileData(mod, mod.mainFile),
                    modDescription: t("detail::item::external_hosted_note"),
                    fileName: mod.modUrl ?? "",
                    fileVersion: "",
                  }
                : modToFileData(mod, mod.mainFile)
            }
            {...(mod.externalRequirement
              ? { fileIconPath: mdiWeb, hideImage: true, onOpenFile: openModPage }
              : {})}
          />

          {mod.externalRequirement && (
            <>
              <Divider variant="and" />

              <div className="mx-6 flex items-center gap-x-3 rounded-sm bg-info-weak/20 p-3">
                <Typography
                  appearance="moderate"
                  as="div"
                  className="grow"
                  typographyType="body-sm"
                >
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
            </>
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
        tracking={{
          api,
          trigger: "single_install",
          issueId: entry.id,
          checkId: checkName,
          modId: mod.modId,
          modCount: 1,
        }}
        onClose={() => setShowPremiumModal(false)}
        onDownload={() => {
          setShowPremiumModal(false);
          openModPage();
        }}
      />
    </>
  );
};
