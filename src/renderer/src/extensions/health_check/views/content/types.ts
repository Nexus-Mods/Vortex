import type { FC } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import type { HealthCheckId } from "../../types";
import type { Severity } from "../../utils/severityStyles";

/**
 * A single item a health check contributes to the listing. Generic across all
 * checks — `data` holds the check-specific payload its own content reads.
 */
export interface IHealthCheckEntry<TData = unknown> {
  /** Stable id, unique within the check; used for keys and as the hide/feedback context. */
  id: string;
  /** The check this entry belongs to; selects the content via the registry. */
  checkId: HealthCheckId;
  /** Drives the severity icon/colour in the shared shell. */
  severity: Severity;
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
 * Centralised UI contract for one health check. Implemented by content modules
 * under views/content/ and listed in the registry. The shared shell is
 * agnostic to the contents — it only calls into this contract.
 */
export interface IHealthCheckContent {
  /** Map this check's result (from state) into listing entries. */
  selectEntries: (state: IState) => IHealthCheckEntry[];
  /** Renders a listing row for one of this check's entries. */
  ListingRow: FC<IListingRowProps>;
  /** Renders the detail body (below the shared chrome) for one entry. */
  DetailView: FC<IDetailViewProps>;
  /** Whether the shell offers hide controls (tabs / hide-all) for this check. */
  supportsHide?: boolean;
  /** Whether the given entry is currently hidden (provider-owned state). */
  isHidden?: (state: IState, entry: IHealthCheckEntry) => boolean;
  /** Toggle hidden for the entry the control was activated on (the click context). */
  toggleHide?: (api: IExtensionApi, entry: IHealthCheckEntry) => void;
}
