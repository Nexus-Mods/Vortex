import type { IExtensionApi } from "../../../types/IExtensionContext";
import { hasActiveFomodDialog } from "../../installer_fomod_shared/utils/helpers";
import type { IActiveInstallation } from "../InstallManager";

/**
 * How long one modal dialog may hold the stall clock. Nothing in the state says who opened a
 * dialog, so it may be an install's prompt (the "already installed" replace prompt, an archive
 * password) or something unrelated, like an error report. Holding the clock forever would let an
 * unrelated dialog switch stall detection off for as long as it stays open.
 */
export const DIALOG_WAIT_LIMIT_MS = 30 * 60 * 1000;

/**
 * Tells whether an install is waiting on the user, in which case the time isn't a stall. Call it
 * on every poll: it remembers how long the dialog at the front of the queue has been open.
 *
 * A FOMOD installer dialog counts for as long as it is open, the user may take as long as they
 * like over it. Any other modal dialog counts for DIALOG_WAIT_LIMIT_MS.
 */
export function createUserWaitTracker(
  dialogWaitLimitMs: number = DIALOG_WAIT_LIMIT_MS,
): (api: IExtensionApi) => boolean {
  let dialogId: string | undefined;
  let dialogSeenAt = 0;

  return (api: IExtensionApi): boolean => {
    if (hasActiveFomodDialog(api)) {
      return true;
    }
    // dialogs are shown one at a time, so the first one is what the user has to answer
    const dialog = api.getState()?.session?.notifications?.dialogs?.[0];
    if (dialog === undefined) {
      dialogId = undefined;
      return false;
    }
    const now = Date.now();
    if (dialog.id !== dialogId) {
      dialogId = dialog.id;
      dialogSeenAt = now;
    }
    return now - dialogSeenAt < dialogWaitLimitMs;
  };
}

/**
 * The installs the stall watchdog of one collection may fail: that collection's own member
 * installs (keyed `<sourceModId>:<downloadId>`) that are at least `minAgeMs` old. Other installs,
 * including the collection archive's own install and other collections' members, aren't part of
 * this collection's stall.
 *
 * The age is a short grace period, not the length of the stall: a member that started after the
 * collection last made progress is younger than the stall but can be what is holding it up.
 */
export function selectStalledMemberInstalls<
  T extends Pick<IActiveInstallation, "installId" | "startTime">,
>(installs: Iterable<T>, sourceModId: string, minAgeMs: number, now: number): T[] {
  const prefix = `${sourceModId}:`;
  const result: T[] = [];
  for (const install of installs) {
    if (install.installId.startsWith(prefix) && now - install.startTime >= minAgeMs) {
      result.push(install);
    }
  }
  return result;
}
