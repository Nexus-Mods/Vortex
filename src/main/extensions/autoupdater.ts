/**
 * Auto-updater Main Process (UI-free version)
 *
 * Handles Electron auto-updater functionality in main process.
 * UI/notifications are handled by the renderer - this just manages the update mechanics.
 */

import type { UpdateStatus } from "@vortex/shared/ipc";
import type {
  autoUpdater as AUType,
  CancellationToken,
  UpdateInfo,
} from "electron-updater";

import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import { app, dialog } from "electron";
import * as semver from "semver";

import { betterIpcMain } from "../ipc";
import { log } from "../logging";

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

/**
 * Set up the auto-updater in main process.
 * Handles checking for updates, downloading, and installing.
 */
export function setupAutoUpdater(installType: string): void {
  const autoUpdater: typeof AUType = require("electron-updater").autoUpdater;

  let cancellationToken: CancellationToken;
  const currentVersion = semver.parse(app.getVersion());
  let updateChannel = "stable";

  // Register invoke handler for status queries
  betterIpcMain.handle("updater:get-status", (): UpdateStatus => {
    return {
      available: updateStatus.available,
      downloaded: updateStatus.downloaded,
      version: updateStatus.version,
      releaseNotes: updateStatus.releaseNotes,
      downloadProgress: updateStatus.downloadProgress,
      error: updateStatus.error,
    };
  });

  log("info", "setupAutoUpdater", {
    installType,
    currentVersion: currentVersion?.version,
  });

  // Configure autoUpdater
  autoUpdater.allowDowngrade = true;
  autoUpdater.autoDownload = false;
  autoUpdater.fullChangelog = true;
  autoUpdater.autoInstallOnAppQuit = false;

  // Error handler
  autoUpdater.on("error", (err) => {
    log("error", "Auto-updater error", {
      error: getErrorMessageOrDefault(err),
    });
    updateStatus.error = getErrorMessageOrDefault(err);
  });

  // Update not available
  autoUpdater.on("update-not-available", () => {
    log("info", "No update available", { channel: updateChannel });
    updateStatus.available = false;
    updateStatus.error = undefined;
  });

  // Update available
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    log("info", "Update available", {
      version: info.version,
      currentVersion: currentVersion?.version,
    });
    updateStatus.available = true;
    updateStatus.version = info.version;
    updateStatus.error = undefined;
    // Capture release notes - can be string or array of release note objects
    if (typeof info.releaseNotes === "string") {
      updateStatus.releaseNotes = info.releaseNotes;
    } else if (Array.isArray(info.releaseNotes)) {
      updateStatus.releaseNotes = info.releaseNotes
        .map((note) => (typeof note === "string" ? note : note.note))
        .join("\n\n");
    }
  });

  // Download progress
  autoUpdater.on("download-progress", (progress) => {
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
        app.removeListener("before-quit", showUpdateWarning);
        autoUpdater.quitAndInstall();
      }
    }
  });

  // Check for updates
  const checkForUpdates = (channel: string, manual: boolean = false) => {
    if (!channel || channel === "none") {
      log("debug", "Updates disabled");
      return;
    }

    const isPreviewBuild = process.env.IS_PREVIEW_BUILD === "true";
    updateChannel = channel;

    log("info", "Checking for updates", { channel, manual, isPreviewBuild });

    autoUpdater.allowPrerelease = channel !== "stable";
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "Nexus-Mods",
      repo: isPreviewBuild ? "Vortex-Staging" : "Vortex",
      private: false,
      publisherName: ["Black Tree Gaming Ltd", "Black Tree Gaming Limited"],
    });

    autoUpdater
      .checkForUpdates()
      .then((check) => {
        log("info", "Update check completed");
        cancellationToken = check?.cancellationToken;

        // Auto-download for regular installs
        if (installType === "regular" && check?.downloadPromise) {
          check.downloadPromise.catch((err) => {
            log("warn", "Auto-download failed", {
              error: getErrorMessageOrDefault(err),
            });
          });
        }
      })
      .catch((err) => {
        log("warn", "Update check failed", {
          error: getErrorMessageOrDefault(err),
        });
      });
  };

  // IPC Handlers
  betterIpcMain.on("updater:set-channel", (_event, channel, manual) => {
    log("info", "Update channel changed", { channel, manual });

    if (cancellationToken) {
      cancellationToken.cancel();
    }

    if (channel !== "none" && process.env.IGNORE_UPDATES !== "yes") {
      checkForUpdates(channel, manual);
    }
  });

  betterIpcMain.on("updater:check-for-updates", (_event, channel, manual) => {
    checkForUpdates(channel, manual);
  });

  betterIpcMain.on(
    "updater:download",
    (_event, channel: string, installAfterDownload: boolean) => {
      log("info", "Download update requested", {
        channel,
        installAfterDownload,
      });

      installAfterDownloadFlag = installAfterDownload;

      const isPreviewBuild = process.env.IS_PREVIEW_BUILD === "true";
      autoUpdater.allowPrerelease = channel !== "stable";
      autoUpdater.setFeedURL({
        provider: "github",
        owner: "Nexus-Mods",
        repo: isPreviewBuild ? "Vortex-Staging" : "Vortex",
        private: false,
        publisherName: ["Black Tree Gaming Ltd", "Black Tree Gaming Limited"],
      });

      autoUpdater.downloadUpdate().catch((unknownErr) => {
        const err = unknownToError(unknownErr);
        log("error", "Download failed", { error: err.message });
        updateStatus.error = err.message;
        installAfterDownloadFlag = false;
      });
    },
  );

  betterIpcMain.on("updater:restart-and-install", () => {
    if (process.env.NODE_ENV !== "development") {
      log("info", "Restarting to install update");
      app.removeListener("before-quit", showUpdateWarning);
      autoUpdater.quitAndInstall();
    } else {
      log("info", "Skipping install (dev mode)");
    }
  });

  log("info", "Auto-updater initialized");
}
