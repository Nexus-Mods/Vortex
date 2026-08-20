import type * as fomodT from "@nexusmods/fomod-installer-native";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";

const NOTIFICATION_ID = "fomod-native-unavailable";

let probe: Promise<typeof fomodT | undefined> | undefined;
let notified = false;

/**
 * Load the native FOMOD addon (`modinstaller.node`), resolving to `undefined`
 * when it can't be loaded in this process.
 *
 * The probe runs once and the result is cached for the session: a failure here
 * is environmental - an unsigned binary rejected by an application control
 * policy (Windows Smart App Control / WDAC), a missing native rebuild - so
 * retrying per install would only pay the cost again for the same answer.
 */
export function loadNativeInstaller(): Promise<typeof fomodT | undefined> {
  if (probe === undefined) {
    // The addon's published types resolve to `any` here, so the assignment can
    // only be as safe as this module's own signature makes it.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    probe = import("@nexusmods/fomod-installer-native").catch((err) => {
      log("error", "Failed to load native FOMOD module", err);
      return undefined;
    });
  }
  return probe;
}

export async function isNativeInstallerAvailable(): Promise<boolean> {
  return (await loadNativeInstaller()) !== undefined;
}

// Dialog.tsx translates each line of dialog text, so these stay plain strings.
function showUnavailableDialog(api: IExtensionApi): void {
  api.showDialog?.(
    "info",
    "FOMOD installer unavailable",
    {
      text:
        "Vortex could not load its built-in FOMOD installer (modinstaller.node). " +
        "This is normally caused by an application control policy blocking the file - " +
        "on Windows 11 that is most often Smart App Control.\n\n" +
        "Vortex will fall back to the out-of-process installer where possible. If that " +
        "one is unavailable too, mods get installed exactly as they are packaged, " +
        "without the per-game path corrections. For Bethesda games that means an " +
        'archive wrapping its content in a "Data" folder ends up nested inside the ' +
        "game's own \"Data\" folder, and the game won't load the mod.\n\n" +
        "If mods are landing in the wrong folders, reinstall them once the installer " +
        "is working again.",
    },
    [{ label: "Close" }],
  );
}

/**
 * Warn the user, once per session, that the native FOMOD installer is gone.
 *
 * Without this the degradation is invisible: both native installers report
 * "unsupported", every mod walks down the priority list to mod_management's
 * `fallback` installer, and that one copies archives verbatim - no stop
 * patterns, no pluginPath stripping. A Bethesda archive that wraps its content
 * in `Data` then stages one level too deep and deploys to `<game>/Data/Data`,
 * where nothing loads it. The install still reports success, so the only clue
 * is a single log line.
 */
export function notifyNativeInstallerUnavailable(api: IExtensionApi): void {
  // Only latch once the warning has actually gone out: the first caller may be
  // holding an api without a notification surface (the native tester runs
  // before the ipc one), and latching on that call would swallow the warning
  // for the rest of the session.
  if (notified || api.sendNotification === undefined) {
    return;
  }
  notified = true;

  api.sendNotification({
    id: NOTIFICATION_ID,
    type: "warning",
    title: "FOMOD installer unavailable",
    message: "Vortex is falling back to a different installer",
    actions: [{ title: "More", action: () => showUnavailableDialog(api) }],
  });
}
