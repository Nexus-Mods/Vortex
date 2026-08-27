/**
 * Auto-updater Main Process (UI-free version)
 *
 * Handles Electron auto-updater functionality in main process.
 * UI/notifications are handled by the renderer - this just manages the update mechanics.
 *
 * Release resolution is ours (releaseResolver.ts): the GitHub releases API is
 * queried directly and the max-semver release for the active channel wins.
 * electron-updater is then pointed at that release's assets via a generic
 * feed, so its job reduces to sha512-verified download, installer signature
 * verification (publisherName from the packaged app-update.yml), and install.
 */

import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import type { UpdateStatus } from "@vortex/shared/ipc";
import { app, dialog } from "electron";
import type { CancellationToken, UpdateInfo } from "electron-updater";
import { autoUpdater } from "electron-updater";
import * as semver from "semver";

import { betterIpcMain } from "../../ipc";
import { log } from "../../logging";
import type { ResolveChannel, ResolvedRelease } from "./releaseResolver";
import {
  classifyUpdate,
  RateLimitError,
  resolveUpdate,
  shouldAutoDownload,
} from "./releaseResolver";

/**
 * Show warning dialog before update installs on quit.
 * Prevents users from turning off computer during installation.
 */
function showUpdateWarning() {
  dialog.showMessageBoxSync({
    type: "info",
    title: "Vortex update",
    message:
      "An update has been downloaded and will now install. " +
      "Please do not turn off your computer until it's done. " +
      "If the installation process is interrupted, Vortex may not work correctly.",
    buttons: ["Continue"],
    noLink: true,
  });
}

// Track update status for renderer queries
const updateStatus: UpdateStatus = {
  available: false,
  downloaded: false,
};

function toResolveChannel(channel: string): ResolveChannel {
  return channel === "beta" || channel === "next" ? channel : "stable";
}

/**
 * Set up the auto-updater in main process.
 * Handles checking for updates, downloading, and installing.
 */
export function setupAutoUpdater(installType: string): void {
  let cancellationToken: CancellationToken | undefined = undefined;
  const currentVersion = app.getVersion();
  let updateChannel = "stable";
  // The release the last successful check resolved to — used only to prefer
  // the resolver's collected release notes over the (empty) generic-feed ones.
  // Downloads never trust it: updater:download re-resolves every time.
  let lastResolved: ResolvedRelease | null = null;
  // Overlapping checks are possible (set-channel + manual check-now); only
  // the newest one may write checking/availability/cancellation state.
  let checkGeneration = 0;

  // Launching the freshly downloaded installer can fail transiently with EBUSY
  // (and similar lock errors) while antivirus still has the ~360 MB file open.
  // Retry quitAndInstall a few times with backoff rather than letting a single
  // transient lock abort the whole update.
  const MAX_INSTALL_ATTEMPTS = 5;
  const INSTALL_RETRY_DELAY_MS = 1000;
  let installAttempts = 0;
  let installPending = false;

  const isInstallerBusyError = (message: string): boolean =>
    /EBUSY|ETXTBSY|EPERM|EACCES|resource busy|being used by another/i.test(message);

  // Launch the downloaded installer. quitAndInstall quits the app on success;
  // on failure it reports via the "error" event (or, rarely, throws), which we
  // route to handleInstallFailure to decide whether to retry.
  function attemptInstall(): void {
    if (process.env.NODE_ENV === "development") {
      log("info", "Skipping install (dev mode)");
      return;
    }
    installPending = true;
    installAttempts += 1;
    // Drop the before-quit warning so retries don't stack duplicate dialogs.
    app.removeListener("before-quit", showUpdateWarning);
    log("info", "Installing update", { attempt: installAttempts });
    try {
      autoUpdater.quitAndInstall();
    } catch (unknownErr) {
      handleInstallFailure(unknownToError(unknownErr));
    }
  }

  function handleInstallFailure(err: Error): void {
    if (!installPending) {
      return;
    }
    if (isInstallerBusyError(err.message) && installAttempts < MAX_INSTALL_ATTEMPTS) {
      log("warn", "Installer launch failed, retrying", {
        error: err.message,
        attempt: installAttempts,
        retryInMs: INSTALL_RETRY_DELAY_MS,
      });
      setTimeout(attemptInstall, INSTALL_RETRY_DELAY_MS);
    } else {
      installPending = false;
      log("error", "Installer launch failed, giving up", {
        error: err.message,
        attempts: installAttempts,
      });
      updateStatus.error = err.message;
    }
  }

  // Register invoke handler for status queries
  betterIpcMain.handle("updater:get-status", (): UpdateStatus => {
    return {
      available: updateStatus.available,
      downloaded: updateStatus.downloaded,
      version: updateStatus.version,
      releaseNotes: updateStatus.releaseNotes,
      downloadProgress: updateStatus.downloadProgress,
      error: updateStatus.error,
      downgrade: updateStatus.downgrade,
      checking: updateStatus.checking,
    };
  });

  log("info", "setupAutoUpdater", { installType, currentVersion });

  // Configure autoUpdater. Downgrades are never taken from background checks;
  // the resolver decides what "latest" means and only strictly-newer versions
  // are handed to electron-updater at all.
  autoUpdater.allowDowngrade = false;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // Error handler
  autoUpdater.on("error", (err) => {
    const message = getErrorMessageOrDefault(err);
    log("error", "Auto-updater error", { error: message });
    updateStatus.error = message;
    // A failed installer launch surfaces here; retry if it's a transient lock.
    if (installPending) {
      handleInstallFailure(unknownToError(err));
    }
  });

  // Update not available
  autoUpdater.on("update-not-available", () => {
    log("info", "No update available", { channel: updateChannel });
    updateStatus.available = false;
    updateStatus.error = undefined;
  });

  // Update available
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    log("info", "Update available", { version: info.version, currentVersion });
    updateStatus.available = true;
    updateStatus.version = info.version;
    updateStatus.error = undefined;
    // The generic feed's latest.yml carries no release notes; the resolver
    // collects them from the GitHub releases instead.
    if (lastResolved?.notesHtml != null) {
      updateStatus.releaseNotes = lastResolved.notesHtml;
    } else if (typeof info.releaseNotes === "string") {
      updateStatus.releaseNotes = info.releaseNotes;
    } else if (Array.isArray(info.releaseNotes)) {
      updateStatus.releaseNotes = info.releaseNotes
        .map((note) => (typeof note === "string" ? note : note.note))
        .join("\n\n");
    }
  });

  // Download progress
  autoUpdater.on("download-progress", (progress: { percent: number }) => {
    log("debug", "Download progress", { percent: progress.percent });
    updateStatus.downloadProgress = progress.percent;
  });

  // Track whether to auto-install after download
  let installAfterDownloadFlag = false;

  // Update downloaded
  autoUpdater.on("update-downloaded", (updateInfo: UpdateInfo) => {
    log("info", "Update downloaded", { version: updateInfo.version });
    updateStatus.downloaded = true;
    updateStatus.downloadProgress = 100;

    // Set up auto-install on quit (unless dev mode)
    if (process.env.NODE_ENV !== "development") {
      autoUpdater.autoInstallOnAppQuit = true;
      app.on("before-quit", showUpdateWarning);
      log("info", "Auto-install on quit enabled");

      // If user requested immediate install, do it now
      if (installAfterDownloadFlag) {
        log("info", "Auto-installing after download");
        installAfterDownloadFlag = false;
        attemptInstall();
      }
    }
  });

  // Point electron-updater at the resolved release and let it re-check;
  // resolves once the library has accepted the feed. Every download goes
  // through this first, so check-before-download holds structurally.
  function applyResolvedFeed(resolved: ResolvedRelease, generation: number): Promise<void> {
    lastResolved = resolved;
    autoUpdater.setFeedURL({ provider: "generic", url: resolved.downloadBaseUrl });
    return autoUpdater.checkForUpdates().then((check) => {
      if (generation === checkGeneration) {
        cancellationToken = check?.cancellationToken;
      }
    });
  }

  // Resolve the channel's target release and, when it's an upgrade, hand the
  // feed to electron-updater. Resolves to the release or null (no upgrade).
  function resolveAndApply(channel: string, generation: number): Promise<ResolvedRelease | null> {
    return resolveUpdate(toResolveChannel(channel), currentVersion).then((resolved) => {
      // Note: switchToStable stays false until the explicit channel-switch
      // downgrade flow ships with its UI; a lower "latest" is ignored here
      // rather than offered (offering it is the old field bug).
      const verdict = classifyUpdate(currentVersion, resolved?.version ?? null, {
        switchToStable: false,
      });
      if (resolved == null || verdict !== "upgrade") {
        const current = semver.valid(currentVersion);
        if (resolved != null && current != null && semver.lt(resolved.version, current)) {
          log("info", "Latest release is older than the running version, ignoring", {
            resolved: resolved.version,
            currentVersion,
            channel,
          });
        } else {
          log("info", "No update available", { channel, resolved: resolved?.version });
        }
        lastResolved = null;
        return null;
      }
      return applyResolvedFeed(resolved, generation).then(() => resolved);
    });
  }

  // Check for updates
  const checkForUpdates = (channel: string, manual: boolean = false) => {
    if (!channel || channel === "none") {
      log("debug", "Updates disabled");
      return;
    }

    updateChannel = channel;
    const generation = ++checkGeneration;
    updateStatus.checking = true;
    log("info", "Checking for updates", { channel, manual, currentVersion });

    resolveAndApply(channel, generation)
      .then((resolved) => {
        if (generation !== checkGeneration) {
          return; // superseded by a newer check; let that one own the status
        }
        updateStatus.checking = false;
        if (resolved == null) {
          updateStatus.available = false;
          updateStatus.version = undefined;
          updateStatus.releaseNotes = undefined;
          updateStatus.error = undefined;
          return;
        }
        log("info", "Update check completed", { version: resolved.version });

        // Auto-download patch updates for regular installs; minor/major
        // updates require user-initiated download via renderer.
        if (shouldAutoDownload(currentVersion, resolved.version, installType)) {
          log("info", "Patch update detected, auto-downloading", {
            from: currentVersion,
            to: resolved.version,
          });
          autoUpdater.downloadUpdate(cancellationToken).catch((err) => {
            log("warn", "Auto-download failed", {
              error: getErrorMessageOrDefault(err),
            });
          });
        }
      })
      .catch((err) => {
        if (generation === checkGeneration) {
          updateStatus.checking = false;
        }
        if (err instanceof RateLimitError) {
          log("warn", "Update check rate-limited", { resetAt: err.resetAt.toISOString() });
        } else {
          log("warn", "Update check failed", { error: getErrorMessageOrDefault(err) });
        }
      });
  };

  // IPC Handlers
  betterIpcMain.on("updater:set-channel", (_event, channel, manual) => {
    log("info", "Update channel changed", { channel, manual });

    if (cancellationToken) {
      cancellationToken.cancel();
    }
    lastResolved = null;

    if (channel !== "none" && process.env.IGNORE_UPDATES !== "yes") {
      checkForUpdates(channel, manual);
    }
  });

  betterIpcMain.on("updater:check-for-updates", (_event, channel, manual) => {
    checkForUpdates(channel, manual);
  });

  betterIpcMain.on("updater:download", (_event, channel: string, installAfterDownload: boolean) => {
    log("info", "Download update requested", {
      channel,
      installAfterDownload,
    });

    // Already downloaded: don't re-fetch the full installer. Re-issuing
    // downloadUpdate when the file is already present can resolve without
    // re-emitting "update-downloaded", which would strand the install request.
    // Install directly instead.
    if (updateStatus.downloaded) {
      log("info", "Update already downloaded, skipping re-download");
      if (installAfterDownload) {
        attemptInstall();
      }
      return;
    }

    installAfterDownloadFlag = installAfterDownload;

    // Always re-resolve for the channel the renderer asked about: a cached
    // resolution could belong to a different channel, and re-applying the
    // feed guarantees the library-side check-before-download. The resolver's
    // ETag cache makes the repeat lookup cheap.
    const generation = ++checkGeneration;
    resolveAndApply(channel, generation)
      .then((resolved) => {
        if (resolved == null) {
          throw new Error("no newer release available to download");
        }
        return autoUpdater.downloadUpdate();
      })
      .catch((unknownErr) => {
        const err = unknownToError(unknownErr);
        log("error", "Download failed", { error: err.message });
        updateStatus.error = err.message;
        installAfterDownloadFlag = false;
      });
  });

  betterIpcMain.on("updater:restart-and-install", () => {
    if (process.env.NODE_ENV !== "development") {
      log("info", "Restarting to install update");
      attemptInstall();
    } else {
      log("info", "Skipping install (dev mode)");
    }
  });

  log("info", "Auto-updater initialized");
}
