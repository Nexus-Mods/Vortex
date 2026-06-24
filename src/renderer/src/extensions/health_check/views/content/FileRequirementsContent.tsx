import {
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
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import {
  downloadFileRequirement,
  openModPage,
  switchActiveVersion,
  viewInLoadout,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import { severityStyleMap } from "@/extensions/health_check/utils/shared/severityStyles";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
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
  IFileLevelRequirements,
  IFileRequirement,
  IFileRequirementCandidate,
  IInstalledFile,
} from "../../types";
import type {
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

/** A download/enable card for one candidate (used by missing + wrong-version-installed). */
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
    />
  );
}

function MissingRequirement({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "missing" }>;
}) {
  const { t } = useTranslation("health_check");
  if (requirement.alternatives.length <= 1) {
    return <CandidateCard candidate={requirement.alternatives[0]} ctx={ctx} />;
  }
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
        {requirement.alternatives.map((candidate) => (
          <CandidateCard candidate={candidate} ctx={ctx} isOr={true} key={candidate.fileUID} />
        ))}
      </div>
    </div>
  );
}

function WrongVersionInstalled({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "wrong-version-installed" }>;
}) {
  const { t } = useTranslation("health_check");
  return (
    <div>
      <Typography appearance="subdued">{t("detail::item::wrong_version_installed")}</Typography>

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
      />

      <Typography appearance="subdued" className="mt-4 mb-2">
        {t("detail::item::required_version")}
      </Typography>

      {requirement.alternatives.map((candidate) => (
        <CandidateCard candidate={candidate} ctx={ctx} key={candidate.fileUID} />
      ))}
    </div>
  );
}

function WrongVersionEnabled({
  api,
  requirement,
}: {
  api: IExtensionApi;
  requirement: Extract<IFileRequirement, { kind: "wrong-version-enabled" }>;
}) {
  const { t } = useTranslation("health_check");
  return (
    <div>
      <Typography appearance="subdued">{t("detail::item::wrong_version_enabled")}</Typography>

      <Typography appearance="subdued" className="mt-1 mb-2">
        {t("detail::item::enabled_version")}
      </Typography>

      <FileRequirement file={installedToFileData(requirement.enabledFile)} />

      <Typography appearance="subdued" className="mt-4 mb-2">
        {t("detail::item::correct_version")}
      </Typography>

      <FileRequirement
        actions={
          <Button
            appearance="strong"
            brand="neutral"
            leftIconPath={mdiSwapHorizontal}
            size="sm"
            onClick={() =>
              switchActiveVersion(api, requirement.enabledFile, requirement.correctFile)
            }
          >
            {t("detail::item::switch_version")}
          </Button>
        }
        file={installedToFileData(requirement.correctFile)}
      />
    </div>
  );
}

function FileRequirementsListingRow({ entry, isHidden, onOpen, onToggleHide }: IListingRowProps) {
  const { t } = useTranslation("health_check");
  const data = entry.data as IFileLevelRequirements;
  const severityStyle = severityStyleMap[entry.severity];

  return (
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
        <Typography className="truncate">{data.sourceModName}</Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {t("listing::item::requires_files", { count: data.requirements.length })}
        </Typography>
      </div>

      <Button
        appearance="moderate"
        brand="neutral"
        leftIconPath={isHidden ? mdiEye : mdiEyeOff}
        size="sm"
        title={isHidden ? t("common:::unhide") : t("common:::hide")}
        onClick={(e) => {
          e.stopPropagation();
          onToggleHide();
        }}
      />

      <Icon className="shrink-0 text-translucent-moderate" path={mdiChevronRight} size="lg" />
    </div>
  );
}

/** The single download candidate for a requirement, if it has an unambiguous one. */
function soleDownloadCandidate(
  requirement: IFileRequirement,
): IFileRequirementCandidate | undefined {
  if (requirement.kind === "missing") {
    return requirement.alternatives.length === 1 ? requirement.alternatives[0] : undefined;
  }
  if (requirement.kind === "wrong-version-installed") {
    return requirement.alternatives[0];
  }
  return undefined;
}

function FileRequirementsDetailView({ entry, api }: IDetailViewProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const data = entry.data as IFileLevelRequirements;

  const showPremiumAd = useSelector(shouldShowPremiumAd);
  // null = closed; otherwise the scope that triggered the upsell (single keeps the
  // candidate so its mod page can be opened on the free fallback action).
  const [premiumRequest, setPremiumRequest] = useState<
    { scope: "single"; candidate: IFileRequirementCandidate } | { scope: "all" } | null
  >(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Feedback is keyed per source file. The persistent store is keyed by number, so
  // we reuse the (numeric) source file UID; the requirement slot holds the same UID
  // as a per-entry marker. NOTE: file-level feedback is persisted only — it does not
  // emit a Mixpanel event yet (HealthCheckFeedbackEvent is mod-shaped).
  const feedbackKey = Number(data.sourceFileUID);
  const feedbackMap = useSelector(feedbackGivenMap);
  const givenFeedback = (feedbackMap[feedbackKey] ?? []).includes(data.sourceFileUID);
  const markFeedback = () => api.store?.dispatch(setFeedbackGiven(feedbackKey, data.sourceFileUID));

  const requestDownload = (candidate: IFileRequirementCandidate) => {
    if (showPremiumAd) {
      setPremiumRequest({ scope: "single", candidate });
      return;
    }
    downloadFileRequirement(api, candidate);
  };

  const ctx: IFileActionContext = { api, showPremiumAd, requestDownload };

  const hasOrs = data.requirements.some(
    (requirement) => requirement.kind === "missing" && requirement.alternatives.length > 1,
  );
  const installAllCandidates = data.requirements
    .map(soleDownloadCandidate)
    .filter((candidate): candidate is IFileRequirementCandidate => candidate !== undefined);

  const installAll = () => {
    if (showPremiumAd) {
      setPremiumRequest({ scope: "all" });
      return;
    }
    installAllCandidates.forEach((candidate) => downloadFileRequirement(api, candidate));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-x-4">
        <Typography appearance="subdued">
          {t("detail::item::requires_files", { count: data.requirements.length })}
        </Typography>

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

          {!hasOrs && installAllCandidates.length > 1 && (
            <Button
              appearance="strong"
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

      <div className="space-y-6">
        {data.requirements.map((requirement) => {
          switch (requirement.kind) {
            case "missing":
              return (
                <MissingRequirement
                  ctx={ctx}
                  key={requirement.requirementDefId}
                  requirement={requirement}
                />
              );
            case "wrong-version-installed":
              return (
                <WrongVersionInstalled
                  ctx={ctx}
                  key={requirement.requirementDefId}
                  requirement={requirement}
                />
              );
            case "wrong-version-enabled":
              return (
                <WrongVersionEnabled
                  api={api}
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

/** Whether a (homogeneous, post-split) file entry's requirements are all hidden. */
function isFileEntryHidden(
  state: Parameters<typeof hiddenFileRequirements>[0],
  entry: IHealthCheckEntry,
): boolean {
  const data = entry.data as IFileLevelRequirements;
  const hidden = hiddenFileRequirements(state)[data.sourceFileUID] ?? [];
  return (
    data.requirements.length > 0 &&
    data.requirements.every((req) => hidden.includes(req.requirementDefId))
  );
}

export const fileRequirementsContent: IHealthCheckContent = {
  // Split each source file into a visible and a hidden entry so a partially
  // dismissed file shows its live issues under Active and its hidden ones under
  // Hidden.
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
      if (visible.length > 0) {
        entries.push({
          id: source.sourceFileUID,
          checkId: FILE_REQUIREMENTS_CHECK_ID,
          severity: "warning",
          data: { ...source, requirements: visible },
        });
      }
      if (dismissed.length > 0) {
        entries.push({
          id: `${source.sourceFileUID}::hidden`,
          checkId: FILE_REQUIREMENTS_CHECK_ID,
          severity: "warning",
          data: { ...source, requirements: dismissed },
        });
      }
    }
    return entries;
  },
  ListingRow: FileRequirementsListingRow,
  DetailView: FileRequirementsDetailView,
  supportsHide: true,
  isHidden: (state, entry) => isFileEntryHidden(state, entry),
  // Toggle the whole entry; per-def storage means a later, newly-unsatisfied
  // dependency on the same file still surfaces.
  toggleHide: (api, entry) => {
    const data = entry.data as IFileLevelRequirements;
    const hide = !isFileEntryHidden(api.getState(), entry);
    for (const req of data.requirements) {
      api.store?.dispatch(setFileRequirementHidden(data.sourceFileUID, req.requirementDefId, hide));
    }
  },
};
