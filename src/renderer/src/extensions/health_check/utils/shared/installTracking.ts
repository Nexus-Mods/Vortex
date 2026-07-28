import { classifyErrorCode } from "@/extensions/analytics/mixpanel/error-code";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { createHealthCheckTracker } from "../../hooks/healthCheckTracker";
import type { OptionalIssueIdentity } from "./tracking";

/**
 * The mod being installed, as every health_check_install_* event identifies it. The identity
 * comes from the component that started the install (`useIssue()?.identity`) and is
 * optional throughout, so the actions stay usable without analytics context.
 */
export type IInstallIdentity = OptionalIssueIdentity & {
  mod_id: number;
  mod_name: string;
  mod_version: string;
};

/**
 * Bracket a health-check-initiated install with the install_started / install_completed /
 * install_failed funnel events (LAZ-551).
 *
 * `run` should cover only the work that follows the user committing to the install — past
 * the premium gate and any id resolution — so a free user being routed to the website, or
 * a requirement with unusable ids, doesn't register as a failed install. Failures are
 * reported with the same low-cardinality tokens as the app-wide mods_installation_failed
 * event, and are re-thrown so callers keep owning the user-facing error handling.
 */
export const trackedInstall = async (
  api: IExtensionApi,
  identity: IInstallIdentity,
  run: () => Promise<void>,
): Promise<void> => {
  const { trackInstallCompleted, trackInstallFailed, trackInstallStarted } =
    createHealthCheckTracker(api);
  const startedAt = Date.now();

  trackInstallStarted(identity);

  try {
    await run();
  } catch (err) {
    trackInstallFailed({
      issue_id: identity.issue_id,
      check_id: identity.check_id,
      mod_id: identity.mod_id,
      error_reason: classifyErrorCode(err),
    });

    throw err;
  }

  trackInstallCompleted({ ...identity, duration_ms: Date.now() - startedAt });
};
