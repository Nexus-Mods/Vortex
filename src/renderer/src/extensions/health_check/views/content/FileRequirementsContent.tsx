import {
  mdiCallSplit,
  mdiChevronRight,
  mdiDownload,
  mdiEye,
  mdiEyeOff,
  mdiOpenInNew,
  mdiSwapHorizontal,
  mdiThumbDown,
  mdiThumbUp,
} from "@mdi/js";
import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import {
  downloadFileRequirement,
  enableInstalledFile,
  installDownloadedFile,
  openFilePage,
  openModPage,
  switchActiveVersion,
  switchActiveVersions,
  viewDownloadInMods,
  viewInLoadout,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import { severityStyleMap } from "@/extensions/health_check/utils/shared/severityStyles";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { joinClasses } from "@/ui/utils/joinClasses";

import { shouldShowPremiumAd } from "../../../nexus_integration/selectors";
import { setFeedbackGiven, setFileRequirementHidden } from "../../actions/persistent";
import { FILE_REQUIREMENTS_CHECK_ID } from "../../checks/fileRequirementsCheck";
import { FeedbackModal } from "../../components/feedback_modal/FeedbackModal";
import {
  FileRequirement,
  type IFileRequirementData,
} from "../../components/file_requirement/FileRequirement";
import { PremiumModal } from "../../components/premium_modal/PremiumModal";
import {
  feedbackGivenMap,
  fileRequirementsCheckResult,
  hiddenFileRequirements,
} from "../../selectors";
import type {
  FileRequirementCategory,
  IDownloadedFile,
  IFileLevelRequirements,
  IFileRequirement,
  IFileRequirementBranch,
  IFileRequirementCandidate,
  IFileRequirementReport,
  IInstalledFile,
  IUninstalledFileRequirement,
} from "../../types";
import type {
  IBulkInstallItem,
  IDetailViewProps,
  IHealthCheckContent,
  IHealthCheckEntry,
  IListingRowProps,
} from "./types";

/** Shared per-detail action context threaded down to the requirement cards. */
interface IFileActionContext {
  api: IExtensionApi;
  showPremiumAd: boolean;
  /** Download a candidate, opening the premium upsell first for free users. */
  requestDownload: (candidate: IFileRequirementCandidate) => void;
}

/** Mod-page / file-page open handlers for a candidate or installed file. */
function fileWebLinks(api: IExtensionApi, ref: { fileUID: string; modUID: string }) {
  return {
    onOpenMod: () => openModPage(api, ref),
    onOpenFile: () => openFilePage(api, ref),
  };
}

/** The report category a requirement belongs to; drives grouping, copy and layout. */
function categoryOf(requirement: IFileRequirement): FileRequirementCategory {
  switch (requirement.kind) {
    case "missing":
      return "download";
    case "wrong-version-installed":
      return "download-replace";
    case "correct-version-uninstalled":
      return "install-uninstalled";
    case "wrong-version-enabled":
      return "toggle";
    case "or":
      return "or";
  }
}

/** Files to download for a report; OR/toggle/install-uninstalled need a user choice or different action. */
function downloadCandidates(requirements: IFileRequirement[]): IFileRequirementCandidate[] {
  return requirements.flatMap((requirement) => {
    switch (requirement.kind) {
      case "missing":
      case "wrong-version-installed":
        return [requirement.candidate];
      default:
        return [];
    }
  });
}

/** Categories whose downloads can be installed in one click (no user choice needed). */
function canQuickInstall(category: FileRequirementCategory): boolean {
  return category === "download" || category === "download-replace";
}

/** Uninstalled files for a report; only the install-uninstalled category contributes. */
function uninstalledFiles(
  requirements: IFileRequirement[],
): Extract<IFileRequirement, IUninstalledFileRequirement>[] {
  return requirements.filter(
    (r): r is Extract<IFileRequirement, IUninstalledFileRequirement> =>
      r.kind === "correct-version-uninstalled",
  );
}

/** The wrong -> correct version switches a toggle report needs (one per requirement). */
function switchTargets(
  requirements: IFileRequirement[],
): Array<{ wrong: IInstalledFile; correct: IInstalledFile }> {
  return requirements.flatMap((requirement) =>
    requirement.kind === "wrong-version-enabled"
      ? [{ wrong: requirement.enabledFile, correct: requirement.correctFile }]
      : [],
  );
}

/** The required mod's display name for one OR alternative. */
function branchModName(branch: IFileRequirementBranch): string {
  return branch.kind === "download" ? branch.candidate.modName : branch.correctFile.modName;
}

/** The required mod's display name for a requirement (used in the listing summary). */
function requirementModName(requirement: IFileRequirement, orJoin: string): string {
  switch (requirement.kind) {
    case "missing":
      return requirement.candidate.modName;
    case "wrong-version-installed":
      return requirement.candidate.modName || requirement.installedFile.modName;
    case "correct-version-uninstalled":
      return requirement.uninstalledFile.modName;
    case "wrong-version-enabled":
      return requirement.correctFile.modName;
    case "or":
      return requirement.branches.map(branchModName).join(orJoin);
  }
}

function candidateToFileData(candidate: IFileRequirementCandidate): IFileRequirementData {
  return {
    fileUID: candidate.fileUID,
    adultContent: candidate.adultContent,
    modName: candidate.modName,
    modDescription: candidate.modSummary ?? "",
    modImageSrc: candidate.thumbnailUrl ?? "",
    fileName: candidate.fileName,
    fileVersion: candidate.version,
    installed: false,
    enabled: false,
  };
}

function installedToFileData(file: IInstalledFile): IFileRequirementData {
  return {
    fileUID: file.fileUID,
    adultContent: file.adultContent,
    modName: file.modName,
    modDescription: "",
    modImageSrc: file.thumbnailUrl ?? "",
    fileName: file.fileName,
    fileVersion: file.version,
    installed: true,
    enabled: file.enabled,
  };
}

function downloadedToFileData(file: IDownloadedFile): IFileRequirementData {
  return {
    fileUID: file.fileUID,
    adultContent: file.adultContent,
    modName: file.modName,
    modDescription: "",
    modImageSrc: file.thumbnailUrl ?? "",
    fileName: file.fileName,
    fileVersion: file.version,
    installed: false,
    enabled: false,
  };
}

/** A download/enable card for one candidate (used by download + OR cards). */
function CandidateCard({
  ctx,
  candidate,
  isOr,
}: {
  ctx: IFileActionContext;
  candidate: IFileRequirementCandidate;
  isOr?: boolean;
}) {
  const { t } = useTranslation(["health_check", "common"]);
  return (
    <FileRequirement
      actions={
        <>
          <Button
            appearance="moderate"
            brand="neutral"
            leftIconPath={mdiOpenInNew}
            size="sm"
            onClick={() => openModPage(ctx.api, candidate)}
          >
            {t("detail::item::install_via_mod_page")}
          </Button>

          <Button
            appearance="strong"
            brand="neutral"
            leftIconPath={mdiDownload}
            rightIcon={ctx.showPremiumAd ? <PremiumBadge /> : undefined}
            size="sm"
            onClick={() => ctx.requestDownload(candidate)}
          >
            {t("detail::item::install_one_click")}
          </Button>
        </>
      }
      file={candidateToFileData(candidate)}
      isOr={isOr}
      {...fileWebLinks(ctx.api, candidate)}
    />
  );
}

/** A "switch to this disabled version" card for one installed file (toggle + OR enable). */
function EnableCard({
  api,
  correctFile,
  enabledFile,
  isOr,
}: {
  api: IExtensionApi;
  correctFile: IInstalledFile;
  /** The wrong version to switch off, if any; absent means a plain enable. */
  enabledFile?: IInstalledFile;
  isOr?: boolean;
}) {
  const { t } = useTranslation("health_check");
  return (
    <FileRequirement
      actions={
        <>
          <Button
            appearance="moderate"
            brand="neutral"
            size="sm"
            onClick={() => viewInLoadout(api, correctFile)}
          >
            {t("detail::item::view_in_loadout")}
          </Button>

          <Button
            appearance="strong"
            brand="neutral"
            leftIconPath={mdiSwapHorizontal}
            size="sm"
            onClick={() =>
              enabledFile
                ? switchActiveVersion(api, enabledFile, correctFile)
                : enableInstalledFile(api, correctFile)
            }
          >
            {t("detail::item::enable_this_version")}
          </Button>
        </>
      }
      file={installedToFileData(correctFile)}
      isOr={isOr}
      {...fileWebLinks(api, correctFile)}
    />
  );
}

/** Download report: each requirement is a single missing file to download. */
function DownloadRequirement({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "missing" }>;
}) {
  return <CandidateCard candidate={requirement.candidate} ctx={ctx} />;
}

/** Download-replace report: a wrong version is enabled; download a different one. */
function ReplaceRequirement({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "wrong-version-installed" }>;
}) {
  const { t } = useTranslation("health_check");
  return (
    <div>
      <Typography appearance="subdued" className="mt-1 mb-2">
        {t("detail::item::installed_version")}
      </Typography>

      <FileRequirement
        actions={
          <Button
            appearance="moderate"
            brand="neutral"
            size="sm"
            onClick={() => viewInLoadout(ctx.api, requirement.installedFile)}
          >
            {t("detail::item::view_in_loadout")}
          </Button>
        }
        file={installedToFileData(requirement.installedFile)}
        {...fileWebLinks(ctx.api, requirement.installedFile)}
      />

      <Typography appearance="subdued" className="mt-4 mb-2">
        {t("detail::item::required_version")}
      </Typography>

      <CandidateCard candidate={requirement.candidate} ctx={ctx} />
    </div>
  );
}

/** Toggle report: the correct version is installed-but-disabled; switch the active version. */
function ToggleRequirement({
  api,
  requirement,
}: {
  api: IExtensionApi;
  requirement: Extract<IFileRequirement, { kind: "wrong-version-enabled" }>;
}) {
  const { t } = useTranslation("health_check");
  return (
    <div>
      <Typography appearance="subdued" className="mt-1 mb-2">
        {t("detail::item::enabled_version")}
      </Typography>

      <FileRequirement
        actions={
          <Button
            appearance="moderate"
            brand="neutral"
            size="sm"
            onClick={() => viewInLoadout(api, requirement.enabledFile)}
          >
            {t("detail::item::view_in_loadout")}
          </Button>
        }
        file={installedToFileData(requirement.enabledFile)}
        {...fileWebLinks(api, requirement.enabledFile)}
      />

      <Typography appearance="subdued" className="mt-4 mb-2">
        {t("detail::item::correct_version")}
      </Typography>

      <EnableCard
        api={api}
        correctFile={requirement.correctFile}
        enabledFile={requirement.enabledFile}
      />
    </div>
  );
}

/** Install-uninstalled report: the correct version is downloaded but not installed. */
function InstallUninstalledRequirement({
  api,
  requirement,
}: {
  api: IExtensionApi;
  requirement: Extract<IFileRequirement, { kind: "correct-version-uninstalled" }>;
}) {
  const { t } = useTranslation("health_check");
  return (
    <FileRequirement
      actions={
        <>
          <Button
            appearance="moderate"
            brand="neutral"
            size="sm"
            onClick={() => viewDownloadInMods(api, requirement.uninstalledFile)}
          >
            {t("detail::item::view_in_mods")}
          </Button>

          <Button
            appearance="strong"
            brand="neutral"
            size="sm"
            onClick={() => void installDownloadedFile(api, requirement.uninstalledFile)}
          >
            {t("detail::item::install_uninstalled")}
          </Button>
        </>
      }
      file={downloadedToFileData(requirement.uninstalledFile)}
      {...fileWebLinks(api, requirement.uninstalledFile)}
    />
  );
}

/** OR report: pick one alternative. Each branch is a download or an enable/switch action. */
function OrRequirement({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "or" }>;
}) {
  const { t } = useTranslation("health_check");
  return (
    <div>
      <Typography
        appearance="moderate"
        brand="neutral-translucent"
        className="rounded-t-lg bg-surface-mid px-3 py-2 font-semibold"
      >
        {t("detail::item::pick_one")}
      </Typography>

      <div className="rounded-b-lg border-x border-b border-stroke-weak p-3">
        {requirement.branches.map((branch) =>
          branch.kind === "download" ? (
            <CandidateCard
              candidate={branch.candidate}
              ctx={ctx}
              isOr={true}
              key={branch.modFileId}
            />
          ) : (
            <EnableCard
              api={ctx.api}
              correctFile={branch.correctFile}
              enabledFile={branch.enabledFile}
              isOr={true}
              key={branch.modFileId}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** The localized title for a report, by category and entry count. */
function useReportCopy(report: IFileRequirementReport) {
  const { t } = useTranslation(["health_check", "common"]);
  const count = report.requirements.length;
  const title = t(count > 1 ? "listing::item::missing_for_plural" : "listing::item::missing_for", {
    modName: report.sourceModName,
  });
  const summary =
    report.category === "or"
      ? t(count > 1 ? "listing::item::requires_pick_plural" : "listing::item::requires_pick", {
          count,
        })
      : t(count > 1 ? "listing::item::requires_count_plural" : "listing::item::requires_count", {
          count,
        });
  return { title, summary };
}

/** Per-source-file feedback state; file-level feedback is keyed by the source file UID. */
function useFileRequirementFeedback(api: IExtensionApi, sourceFileUID: string) {
  const feedbackKey = Number(sourceFileUID);
  const feedbackMap = useSelector(feedbackGivenMap);
  const givenFeedback = (feedbackMap[feedbackKey] ?? []).includes(sourceFileUID);
  const markFeedback = () => api.store?.dispatch(setFeedbackGiven(feedbackKey, sourceFileUID));
  return { givenFeedback, markFeedback };
}

function FileRequirementsListingRow({
  api,
  entry,
  isHidden,
  onOpen,
  onToggleHide,
}: IListingRowProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const report = entry.data as IFileRequirementReport;
  const severityStyle = severityStyleMap[entry.severity];
  const { title, summary } = useReportCopy(report);

  const showPremiumAd = useSelector(shouldShowPremiumAd);
  const [showPremium, setShowPremium] = useState(false);
  const { givenFeedback, markFeedback } = useFileRequirementFeedback(api, report.sourceFileUID);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const candidates = downloadCandidates(report.requirements);
  const quickInstall = canQuickInstall(report.category) && candidates.length > 0;
  const switches = switchTargets(report.requirements);
  const toInstall = uninstalledFiles(report.requirements);
  const orJoin = ` ${t("listing::item::or_join")} `;

  const names = report.requirements
    .map((requirement) => requirementModName(requirement, orJoin))
    .filter(Boolean);
  const namesLine =
    names.length > 1
      ? `${names[0]} ${t("listing::item::more_count", { count: names.length - 1 })}`
      : names[0];

  const doQuickInstall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showPremiumAd) {
      setShowPremium(true);
      return;
    }
    candidates.forEach((candidate) => void downloadFileRequirement(api, candidate));
  };

  return (
    <>
      <div
        className="group hover-overlay-weak flex w-full cursor-pointer items-center gap-x-4 rounded-sm bg-surface-mid px-4 py-3 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info-subdued"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (["Enter", " "].includes(e.key)) {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <Icon
          className={joinClasses(["shrink-0", severityStyle.textClassName])}
          path={severityStyle.iconPath}
        />

        <div className="min-w-0 grow text-left">
          <div className="flex items-start justify-between gap-x-4">
            <div className="min-w-0">
              <Typography className="truncate">{title}</Typography>

              <Typography appearance="subdued" as="div" typographyType="body-sm">
                {summary}
              </Typography>

              <Typography appearance="subdued" className="truncate" typographyType="body-sm">
                {namesLine}
              </Typography>
            </div>

            <div className="invisible flex shrink-0 gap-x-1 group-focus-within:visible group-hover:visible">
              <Button
                appearance="weak"
                brand="neutral"
                disabled={givenFeedback}
                leftIconPath={mdiThumbUp}
                size="sm"
                title={t("common:::helpful")}
                onClick={(e) => {
                  e.stopPropagation();
                  markFeedback();
                }}
              />

              <Button
                appearance="weak"
                brand="neutral"
                disabled={givenFeedback}
                leftIconPath={mdiThumbDown}
                size="sm"
                title={t("common:::not_helpful")}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFeedbackModal(true);
                }}
              />

              <Button
                appearance="weak"
                brand="neutral"
                leftIconPath={isHidden ? mdiEye : mdiEyeOff}
                size="sm"
                title={isHidden ? t("common:::unhide") : t("common:::hide")}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHide();
                }}
              />
            </div>
          </div>
        </div>

        {quickInstall ? (
          <Button
            appearance="moderate"
            brand="neutral"
            leftIconPath={mdiDownload}
            rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
            size="sm"
            onClick={doQuickInstall}
          >
            {candidates.length === 1
              ? t("detail::item::install_one_click")
              : t("listing::install_one_click", { count: candidates.length })}
          </Button>
        ) : report.category === "or" ? (
          <Button
            appearance="moderate"
            brand="neutral"
            leftIconPath={mdiCallSplit}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            {t("listing::pick_mod_install")}
          </Button>
        ) : report.category === "toggle" && switches.length > 0 ? (
          <Button
            appearance="moderate"
            brand="neutral"
            leftIconPath={mdiSwapHorizontal}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              switchActiveVersions(api, switches);
            }}
          >
            {t("detail::item::enable_this_version")}
          </Button>
        ) : report.category === "install-uninstalled" && toInstall.length > 0 ? (
          <Button
            appearance="moderate"
            brand="neutral"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              toInstall.forEach((req) => void installDownloadedFile(api, req.uninstalledFile));
            }}
          >
            {t("listing::install_uninstalled")}
          </Button>
        ) : null}

        <Icon className="shrink-0 text-translucent-moderate" path={mdiChevronRight} size="lg" />
      </div>

      <PremiumModal
        downloadScope={candidates.length === 1 ? "single" : "all"}
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
        onDownload={() => {
          setShowPremium(false);
          // Free-user fallback: a single candidate opens its mod page; otherwise
          // open the detail so each requirement's mod page is reachable.
          if (candidates.length === 1) {
            openModPage(api, candidates[0]);
          } else {
            onOpen();
          }
        }}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSuccess={() => {
          markFeedback();
          setShowFeedbackModal(false);
        }}
      />
    </>
  );
}

function FileRequirementsDetailView({ entry, api, onBack }: IDetailViewProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const report = entry.data as IFileRequirementReport;
  const severityStyle = severityStyleMap[entry.severity];
  const count = report.requirements.length;

  const isHidden = useSelector((state: IState) => isFileEntryHidden(state, entry));
  const toggleHideEntry = () => {
    for (const req of report.requirements) {
      api.store?.dispatch(
        setFileRequirementHidden(report.sourceFileUID, req.requirementDefId, !isHidden),
      );
    }
    onBack();
  };

  const showPremiumAd = useSelector(shouldShowPremiumAd);
  // null = closed; otherwise the scope that triggered the upsell (single keeps the
  // candidate so its mod page can be opened on the free fallback action).
  const [premiumRequest, setPremiumRequest] = useState<
    { scope: "single"; candidate: IFileRequirementCandidate } | { scope: "all" } | null
  >(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Feedback is keyed per source file (see useFileRequirementFeedback). NOTE:
  // file-level feedback is persisted only, it does not emit a Mixpanel event yet
  // (HealthCheckFeedbackEvent is mod-shaped).
  const { givenFeedback, markFeedback } = useFileRequirementFeedback(api, report.sourceFileUID);

  const requestDownload = (candidate: IFileRequirementCandidate) => {
    // downloadFileRequirement routes free users to the file page (open-the-website
    // fallback) and premium users to the real 1-click download.
    void downloadFileRequirement(api, candidate);
  };

  const ctx: IFileActionContext = { api, showPremiumAd, requestDownload };

  const installAllCandidates = canQuickInstall(report.category)
    ? downloadCandidates(report.requirements)
    : [];

  const installAll = () => {
    if (showPremiumAd) {
      setPremiumRequest({ scope: "all" });
      return;
    }
    installAllCandidates.forEach((candidate) => void downloadFileRequirement(api, candidate));
  };

  // Report-level intro line, mirroring the per-category detail copy.
  const subtitle =
    report.category === "toggle"
      ? t("detail::item::wrong_version_enabled")
      : report.category === "download-replace"
        ? t("detail::item::wrong_version_installed")
        : report.category === "install-uninstalled"
          ? t("detail::item::correct_version_downloaded")
          : t(count > 1 ? "detail::item::requires_files_plural" : "detail::item::requires_files", {
              count,
            });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-x-4">
        <div className="flex min-w-0 items-center gap-x-2">
          <Icon
            className={joinClasses(["shrink-0", severityStyle.textClassName])}
            path={severityStyle.iconPath}
          />

          <Typography as="div" className="font-semibold">
            <Trans
              components={{
                modLink: (
                  <TypographyLink
                    brand="primary"
                    typographyType="inherit"
                    variant="secondary"
                    onClick={() =>
                      openModPage(api, {
                        fileUID: report.sourceFileUID,
                        modUID: report.sourceModUID,
                      })
                    }
                  />
                ),
              }}
              count={count}
              i18nKey="detail::item::missing_for"
              ns="health_check"
              values={{ modName: report.sourceModName }}
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
            onClick={markFeedback}
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
            onClick={toggleHideEntry}
          />

          {installAllCandidates.length > 1 && (
            <Button
              appearance="moderate"
              brand="neutral"
              leftIconPath={mdiDownload}
              rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
              size="sm"
              onClick={installAll}
            >
              {t("actions::install_all", { count: installAllCandidates.length })}
            </Button>
          )}
        </div>
      </div>

      <Typography appearance="subdued">{subtitle}</Typography>

      <div className="space-y-6">
        {report.requirements.map((requirement) => {
          switch (requirement.kind) {
            case "missing":
              return (
                <DownloadRequirement
                  ctx={ctx}
                  key={requirement.requirementDefId}
                  requirement={requirement}
                />
              );
            case "wrong-version-installed":
              return (
                <ReplaceRequirement
                  ctx={ctx}
                  key={requirement.requirementDefId}
                  requirement={requirement}
                />
              );
            case "correct-version-uninstalled":
              return (
                <InstallUninstalledRequirement
                  api={api}
                  key={requirement.requirementDefId}
                  requirement={requirement}
                />
              );
            case "wrong-version-enabled":
              return (
                <ToggleRequirement
                  api={api}
                  key={requirement.requirementDefId}
                  requirement={requirement}
                />
              );
            case "or":
              return (
                <OrRequirement
                  ctx={ctx}
                  key={requirement.requirementDefId}
                  requirement={requirement}
                />
              );
          }
        })}
      </div>

      <PremiumModal
        downloadScope={premiumRequest?.scope ?? "single"}
        isOpen={premiumRequest !== null}
        onClose={() => setPremiumRequest(null)}
        onDownload={() => {
          // Free-user fallback: for a single candidate, open its mod page.
          if (premiumRequest?.scope === "single") {
            openModPage(api, premiumRequest.candidate);
          }
          setPremiumRequest(null);
        }}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSuccess={() => {
          markFeedback();
          setShowFeedbackModal(false);
        }}
      />
    </div>
  );
}

/** Whether a (homogeneous, per-category) report entry's requirements are all hidden. */
function isFileEntryHidden(
  state: Parameters<typeof hiddenFileRequirements>[0],
  entry: IHealthCheckEntry,
): boolean {
  const report = entry.data as IFileRequirementReport;
  const hidden = hiddenFileRequirements(state)[report.sourceFileUID] ?? [];
  return (
    report.requirements.length > 0 &&
    report.requirements.every((req) => hidden.includes(req.requirementDefId))
  );
}

/** Group one source file's (visible or hidden) requirements into per-category report entries. */
function pushReportEntries(
  entries: IHealthCheckEntry[],
  source: IFileLevelRequirements,
  requirements: IFileRequirement[],
  hidden: boolean,
): void {
  const byCategory = new Map<FileRequirementCategory, IFileRequirement[]>();
  for (const requirement of requirements) {
    const category = categoryOf(requirement);
    const bucket = byCategory.get(category);
    if (bucket) {
      bucket.push(requirement);
    } else {
      byCategory.set(category, [requirement]);
    }
  }

  for (const [category, reqs] of byCategory) {
    entries.push({
      id: `${source.sourceFileUID}:${category}${hidden ? "::hidden" : ""}`,
      checkId: FILE_REQUIREMENTS_CHECK_ID,
      severity: "warning",
      data: {
        sourceFileUID: source.sourceFileUID,
        sourceModName: source.sourceModName,
        sourceModUID: source.sourceModUID,
        category,
        requirements: reqs,
      },
    });
  }
}

export const fileRequirementsContent: IHealthCheckContent = {
  // Split each source file into per-category reports, and each report into a visible
  // and a hidden entry, so a partially dismissed file shows its live issues under
  // Active and its hidden ones under Hidden.
  selectEntries: (state) => {
    const result = fileRequirementsCheckResult(state);
    if (!result) {
      return [];
    }
    const hiddenMap = hiddenFileRequirements(state);
    const entries: IHealthCheckEntry[] = [];
    for (const source of Object.values(result)) {
      const hidden = new Set(hiddenMap[source.sourceFileUID] ?? []);
      const visible = source.requirements.filter((req) => !hidden.has(req.requirementDefId));
      const dismissed = source.requirements.filter((req) => hidden.has(req.requirementDefId));
      pushReportEntries(entries, source, visible, false);
      pushReportEntries(entries, source, dismissed, true);
    }
    return entries;
  },
  ListingRow: FileRequirementsListingRow,
  DetailView: FileRequirementsDetailView,
  supportsHide: true,
  isHidden: (state, entry) => isFileEntryHidden(state, entry),
  // Toggle the whole report; per-def storage means a later, newly-unsatisfied
  // dependency on the same file still surfaces.
  toggleHide: (api, entry) => {
    const report = entry.data as IFileRequirementReport;
    const hide = !isFileEntryHidden(api.getState(), entry);
    for (const req of report.requirements) {
      api.store?.dispatch(
        setFileRequirementHidden(report.sourceFileUID, req.requirementDefId, hide),
      );
    }
  },
  // Active (non-hidden) no-choice downloads from the download / download-replace
  // reports; OR (needs a choice) and toggle (no download) are excluded.
  collectInstallAll: (state: IState, api: IExtensionApi): IBulkInstallItem[] => {
    const result = fileRequirementsCheckResult(state);
    if (!result) {
      return [];
    }
    const hiddenMap = hiddenFileRequirements(state);
    const items: IBulkInstallItem[] = [];
    for (const source of Object.values(result)) {
      const hidden = new Set(hiddenMap[source.sourceFileUID] ?? []);
      for (const requirement of source.requirements) {
        if (hidden.has(requirement.requirementDefId)) {
          continue;
        }
        for (const candidate of downloadCandidates([requirement])) {
          items.push({
            key: candidate.fileUID,
            install: () => void downloadFileRequirement(api, candidate),
          });
        }
        if (requirement.kind === "correct-version-uninstalled") {
          items.push({
            key: requirement.uninstalledFile.fileUID,
            install: () => void installDownloadedFile(api, requirement.uninstalledFile),
          });
        }
      }
    }
    return items;
  },
};
