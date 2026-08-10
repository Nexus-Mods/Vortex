import type { FC } from "react";

import type { Severity } from "@/extensions/health_check/utils/shared/severityStyles";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import type { HealthCheckId } from "../../types";
import type { ResolutionType } from "../../utils/shared/tracking";

/**
 * A single item a health check contributes to the listing. Generic across all
 * checks — `data` holds the check-specific payload its own content reads.
 */
export interface IHealthCheckEntry<TData = unknown> {
  /**
   * Unique within the check; used for row keys, for resolving the open detail against
   * live state, and as the hide/feedback context. May encode mutable UI state — a file
   * requirement's id changes when it is dismissed — so it is not an analytics identity.
   */
  id: string;
  /**
   * The issue's stable analytics identity, reported as `issue_id`. Defaults to `id`;
   * set it only when `id` can change for what is logically the same issue, or the
   * events either side of that change won't join.
   */
  issueId?: string;
  /** The check this entry belongs to; selects the content via the registry. */
  checkId: HealthCheckId;
  /** Drives the severity icon/colour in the shared shell. */
  severity: Severity;
  /**
   * Which resolution flow this issue offers, reported as `resolution_type`. Set by the
   * content module, which is the only thing that knows — deriving it centrally would
   * mean reaching into each check's `data`.
   */
  resolutionType: ResolutionType;
  /** Check-specific payload (e.g. IFileLevelRequirements, IModRequirementExt). */
  data: TData;
}

export interface IListingRowProps {
  api: IExtensionApi;
  entry: IHealthCheckEntry;
  isHidden: boolean;
  onOpen: () => void;
  onToggleHide: () => void;
}

export interface IDetailViewProps {
  entry: IHealthCheckEntry;
  api: IExtensionApi;
  onBack: () => void;
}

/**
 * A no-choice download/install item a check contributes to the page-level
 * "1-click install all" button. Items are de-duplicated across checks by `key`.
 */
export interface IBulkInstallItem {
  /** Stable key for de-duplication across checks (the file/mod to download). */
  key: string;
  /** Trigger this item's download/install. */
  install: () => void;
}

/**
 * Centralised UI contract for one health check. Implemented by content modules
 * under views/content/ and listed in the registry. The shared shell is
 * agnostic to the contents — it only calls into this contract.
 */
export interface IHealthCheckContent {
  /** Map this check's result (from state) into listing entries. */
  selectEntries: (state: IState) => IHealthCheckEntry[];
  /** Renders a listing row for one of this check's entries. */
  ListingRow: FC<React.PropsWithChildren<IListingRowProps>>;
  /** Renders the detail body (below the shared chrome) for one entry. */
  DetailView: FC<React.PropsWithChildren<IDetailViewProps>>;
  /** Whether the shell offers hide controls (tabs / hide-all) for this check. */
  supportsHide?: boolean;
  /** Whether the given entry is currently hidden (provider-owned state). */
  isHidden?: (state: IState, entry: IHealthCheckEntry) => boolean;
  /** Toggle hidden for the entry the control was activated on (the click context). */
  toggleHide?: (api: IExtensionApi, entry: IHealthCheckEntry) => void;
  /**
   * No-choice download/install items contributed to the page-level "1-click
   * install all" button. Excludes anything needing a user choice (OR) or a
   * non-download action (enable/switch). Omit when nothing is one-click-installable.
   * TODO(LAZ-471): extend to enable/switch/reinstall cases once that scope is agreed.
   */
  collectInstallAll?: (state: IState, api: IExtensionApi) => IBulkInstallItem[];
}
