import {
  downloadFileRequirement,
  installDownloadedFile,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import {
  downloadCandidates,
  type IFileRequirementReport,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import { setFileRequirementHidden } from "../../actions/persistent";
import { DetailView } from "../../components/file_requirement/DetailView";
import { ListingRow } from "../../components/file_requirement/ListingRow";
import { fileRequirementsCheckResult, hiddenFileRequirements } from "../../selectors";
import { isFileEntryHidden, pushReportEntries } from "./fileRequirementEntries";
import type { IBulkInstallItem, IHealthCheckContent, IHealthCheckEntry } from "./types";

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
  ListingRow,
  DetailView,
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
