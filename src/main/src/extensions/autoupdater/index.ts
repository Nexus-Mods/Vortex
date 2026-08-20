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
import { app, BrowserWindow, dialog } from "electron";
import type { CancellationToken, UpdateInfo } from "electron-updater";
import { autoUpdater } from "electron-updater";
import * as semver from "semver";

import { betterIpcMain } from "../../ipc";
import { log } from "../../logging";
import { readPersistedValue, writePersistedValue } from "../../store/mainPersistence";
import type { ResolveChannel, ResolvedRelease } from "./releaseResolver";
import {
  classifyUpdate,
  RateLimitError,
  resolveUpdate,
  shouldAutoDownload,
} from "./releaseResolver";

/**
 * Warn once, non-blocking, that the downloaded update installs on quit.
 * The old implementation used showMessageBoxSync in before-quit: it blocked
 * the quitting main process (the dialog could not be dismissed) and the
 * handler was never removed, so every re-entered quit attempt stacked
 * another modal — an unkillable dialog loop in the field.
 */
function showUpdateWarning() {
  // one-shot: quit processing can re-fire before-quit
  app.removeListener("before-quit", showUpdateWarning);
  void dialog.showMessageBox({
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
  // The downgrade offered after an explicit switch to stable, awaiting the
  // user's confirmation via updater:download-downgrade. Cleared by any check.
  let pendingDowngrade: ResolvedRelease | null = null;
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
    // Never install from an unpackaged (run-from-source) build: with the dev
    // updater enabled a real installer may have been downloaded, and running
    // it would install over the machine's actual Vortex.
    if (process.env.NODE_ENV === "development" || !app.isPackaged) {
      log("info", "Skipping install (unpackaged/dev build)");
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
      broadcastStatus();
    }
  }

  function statusSnapshot(): UpdateStatus {
    // updateStatus holds only serializable scalars; a spread can't silently
    // drop a newly added field the way a hand-maintained list can
    return { ...updateStatus };
  }

  // Push the current status to every window; the renderer reacts to these
  // instead of polling (getStatus remains for the initial sync).
  function broadcastStatus(): void {
    const snapshot = statusSnapshot();
    for (const win of BrowserWindow.getAllWindows()) {
      betterIpcMain.send(win.webContents, "updater:status-changed", snapshot);
    }
  }

  // Register invoke handler for status queries
  betterIpcMain.handle("updater:get-status", (): UpdateStatus => statusSnapshot());

  // Release notes for the update the app just went through — the renderer's
  // post-update "View changes". The resolver collects body_html of releases
  // above the given version, so resolving from the pre-update version yields
  // exactly the versions this update covered. The renderer supplies its
  // persisted channel: this handler is clickable before the first check has
  // set updateChannel, which would otherwise default beta users to stable
  // notes. Cached so repeat clicks don't share rate-limit fate with real
  // update checks.
  let changelogCache: { channel: string; notes: string | null } | null = null;
  betterIpcMain.handle(
    "updater:get-update-changelog",
    async (_event, channel: string): Promise<string | null> => {
      const previous = updateStatus.justUpdatedFrom;
      if (previous == null) {
        return null;
      }
      const resolveChannel = toResolveChannel(channel);
      if (changelogCache != null && changelogCache.channel === resolveChannel) {
        return changelogCache.notes;
      }
      try {
        const resolvedRelease = await resolveUpdate(resolveChannel, previous);
        const notes = resolvedRelease?.notesHtml ?? null;
        if (notes != null) {
          changelogCache = { channel: resolveChannel, notes };
        }
        return notes;
      } catch (err) {
        log("warn", "Failed to fetch post-update changelog", {
          error: getErrorMessageOrDefault(err),
        });
        return null;
      }
    },
  );

  // Surface "Vortex was updated" on the first launch after an update: the
  // renderer store persists appVersion each run, so at startup it still holds
  // the previous run's version. Not in dev, where the version is a moving
  // placeholder.
  if (process.env.NODE_ENV !== "development") {
    void readPersistedValue<string>("app", ["appVersion"])
      .then((previous) => {
        if (
          previous != null &&
          semver.valid(previous) != null &&
          semver.valid(currentVersion) != null &&
          semver.gt(currentVersion, previous)
        ) {
          updateStatus.justUpdatedFrom = previous;
          broadcastStatus();
        }
      })
      .catch((err: unknown) => {
        log("debug", "Could not read previous app version", {
          error: getErrorMessageOrDefault(err),
        });
      });
  }

  log("info", "setupAutoUpdater", { installType, currentVersion });

  // Configure autoUpdater. Downgrades are never taken from background checks;
  // the resolver decides what "latest" means and only strictly-newer versions
  // are handed to electron-updater at all.
  autoUpdater.allowDowngrade = false;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // Vortex ships full NSIS installers only; refuse web-installer files (which
  // can lack signature verification).
  autoUpdater.disableWebInstaller = true;

  // Route the library's own log lines (differential-download fallbacks,
  // signature verification, cache decisions) into vortex.log — by default
  // they only reach the console and are invisible in the field.
  autoUpdater.logger = {
    info: (message: unknown) => log("info", "electron-updater", { message }),
    warn: (message: unknown) => log("warn", "electron-updater", { message }),
    error: (message: unknown) => log("warn", "electron-updater error", { message }),
    debug: (message: string) => log("debug", "electron-updater", { message }),
  };

  // Run-from-source builds skip the library's check ("application is not
  // packed"). Opting in via VORTEX_DEV_UPDATER=1 makes it read
  // dev-app-update.yml (in src/main) instead, so check/notify/download can be
  // exercised against the mock feed. Installs stay packaged-only regardless.
  if (!app.isPackaged && process.env.VORTEX_DEV_UPDATER === "1") {
    autoUpdater.forceDevUpdateConfig = true;
    log("info", "Dev updater enabled (forceDevUpdateConfig, dev-app-update.yml)");
  }

  // Error handler
  autoUpdater.on("error", (err) => {
    const message = getErrorMessageOrDefault(err);
    log("error", "Auto-updater error", { error: message });
    updateStatus.error = message;
    // A failed installer launch surfaces here; retry if it's a transient lock.
    if (installPending) {
      handleInstallFailure(unknownToError(err));
    }
    broadcastStatus();
  });

  // Update not available
  autoUpdater.on("update-not-available", () => {
    log("info", "No update available", { channel: updateChannel });
    updateStatus.available = false;
    updateStatus.error = undefined;
    broadcastStatus();
  });

  // Update available
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    log("info", "Update available", { version: info.version, currentVersion });
    updateStatus.available = true;
    updateStatus.version = info.version;
    updateStatus.error = undefined;
    // A previously downloaded installer belongs to the version it was
    // downloaded for; advertising a different version with downloaded:true
    // would offer "Restart & Install" for a build that isn't on disk.
    // Re-advertising the downloaded version (e.g. switching a channel back)
    // restores it.
    if (info.version !== downloadedVersion) {
      updateStatus.downloaded = false;
      updateStatus.downloadProgress = undefined;
    } else if (downloadedVersion != null) {
      updateStatus.downloaded = true;
      updateStatus.downloadProgress = 100;
    }
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
    broadcastStatus();
  });

  // Download progress. Progress events fire many times per second on a
  // ~360 MB installer; broadcast only whole-percent changes.
  let lastBroadcastPercent = -1;
  autoUpdater.on("download-progress", (progress: { percent: number }) => {
    log("debug", "Download progress", { percent: progress.percent });
    updateStatus.downloadProgress = progress.percent;
    const wholePercent = Math.floor(progress.percent);
    if (wholePercent !== lastBroadcastPercent) {
      lastBroadcastPercent = wholePercent;
      broadcastStatus();
    }
  });

  // Track whether to auto-install after download
  let installAfterDownloadFlag = false;
  // The version the downloaded installer actually contains; the downloaded
  // flag is only meaningful for this version.
  let downloadedVersion: string | null = null;

  // Update downloaded
  autoUpdater.on("update-downloaded", (updateInfo: UpdateInfo) => {
    log("info", "Update downloaded", { version: updateInfo.version });
    downloadedVersion = updateInfo.version;
    updateStatus.downloaded = true;
    updateStatus.version = updateInfo.version;
    updateStatus.downloadProgress = 100;
    lastBroadcastPercent = -1;
    broadcastStatus();

    // Set up auto-install on quit (packaged builds only — an unpackaged run
    // with the dev updater must never install what it downloaded)
    if (process.env.NODE_ENV !== "development" && app.isPackaged) {
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
    // useMultipleRangeRequest: false — GitHub's release downloads are
    // S3-backed and don't serve multipart/byteranges; without this every
    // differential download degrades to a full download (electron-updater's
    // own GitHub provider hard-codes the same).
    autoUpdater.setFeedURL({
      provider: "generic",
      url: resolved.downloadBaseUrl,
      useMultipleRangeRequest: false,
    });
    return autoUpdater.checkForUpdates().then((check) => {
      if (generation === checkGeneration) {
        cancellationToken = check?.cancellationToken;
      }
    });
  }

  type ResolveOutcome =
    | { verdict: "upgrade" | "downgrade-offer"; release: ResolvedRelease }
    | { verdict: "none"; release: null };

  // Resolve the channel's target release. Upgrades get handed to
  // electron-updater as the feed; downgrade offers are returned for the
  // caller to surface (only ever produced when allowDowngradeOffer is set,
  // i.e. after an explicit switch to stable). A lower "latest" is otherwise
  // ignored — offering it unasked is the old field bug.
  function resolveAndApply(
    channel: string,
    generation: number,
    allowDowngradeOffer: boolean = false,
  ): Promise<ResolveOutcome> {
    return resolveUpdate(toResolveChannel(channel), currentVersion).then((resolved) => {
      const verdict = classifyUpdate(currentVersion, resolved?.version ?? null, {
        switchToStable: allowDowngradeOffer,
      });
      if (resolved == null || verdict === "none") {
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
        return { verdict: "none", release: null };
      }
      if (verdict === "downgrade-offer") {
        log("info", "Stable release is older than the running version, offering downgrade", {
          resolved: resolved.version,
          currentVersion,
        });
        lastResolved = null;
        return { verdict, release: resolved };
      }
      return applyResolvedFeed(resolved, generation).then(() => ({
        verdict: "upgrade" as const,
        release: resolved,
      }));
    });
  }

  // Check for updates. allowDowngradeOffer is only set for a purposeful
  // switch to the stable channel — the one flow where a lower version may be
  // offered. Background checks (launch sync, periodic, Check now) never
  // surface downgrades.
  const checkForUpdates = (
    channel: string,
    manual: boolean = false,
    allowDowngradeOffer: boolean = false,
  ) => {
    if (!channel || channel === "none") {
      log("debug", "Updates disabled");
      return;
    }

    updateChannel = channel;
    const generation = ++checkGeneration;
    pendingDowngrade = null;
    updateStatus.downgrade = undefined;
    updateStatus.downgrading = undefined;
    updateStatus.patch = undefined;
    updateStatus.checking = true;
    updateStatus.manual = manual;
    broadcastStatus();
    log("info", "Checking for updates", { channel, manual, currentVersion });

    resolveAndApply(channel, generation, allowDowngradeOffer)
      .then((outcome) => {
        if (generation !== checkGeneration) {
          return; // superseded by a newer check; let that one own the status
        }
        updateStatus.checking = false;
        if (outcome.verdict === "none") {
          updateStatus.available = false;
          updateStatus.version = undefined;
          updateStatus.releaseNotes = undefined;
          updateStatus.error = undefined;
          broadcastStatus();
          return;
        }
        if (outcome.verdict === "downgrade-offer") {
          // Surface the offer; nothing downloads until the user confirms via
          // updater:download-downgrade.
          pendingDowngrade = outcome.release;
          updateStatus.available = true;
          updateStatus.downgrade = true;
          updateStatus.version = outcome.release.version;
          updateStatus.releaseNotes = undefined;
          updateStatus.error = undefined;
          broadcastStatus();
          return;
        }
        const resolved = outcome.release;
        // Classify for the renderer: patch updates auto-download and get
        // quieter notifications. Only the winning generation writes the flag
        // (this block already returned above when superseded), so a slow
        // stale check can't relabel a different offer.
        updateStatus.patch = shouldAutoDownload(currentVersion, resolved.version, installType);
        broadcastStatus();
        log("info", "Update check completed", { version: resolved.version });

        // Auto-download patch updates for regular installs; minor/major
        // updates require user-initiated download via renderer.
        if (updateStatus.patch === true) {
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
          broadcastStatus();
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
      // A user-initiated switch to stable is the one flow allowed to offer a
      // downgrade (e.g. leaving the beta channel from a beta build).
      checkForUpdates(channel, manual, manual === true && channel === "stable");
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
    // Install directly instead — but only when the installer on disk is the
    // version currently being offered; a channel switch can leave a stale
    // download for a different version.
    if (
      updateStatus.downloaded &&
      downloadedVersion != null &&
      downloadedVersion === updateStatus.version
    ) {
      log("info", "Update already downloaded, skipping re-download", {
        version: downloadedVersion,
      });
      if (installAfterDownload) {
        attemptInstall();
      }
      return;
    }

    installAfterDownloadFlag = installAfterDownload;

    // Always re-resolve for the channel the renderer asked about: a cached
    // resolution could belong to a different channel, and re-applying the
    // feed guarantees the library-side check-before-download. The resolver's
    // ETag cache makes the repeat lookup cheap. The download owns the
    // checking lifecycle for the generation it claims, so a check it
    // superseded can't strand checking:true.
    const generation = ++checkGeneration;
    updateStatus.checking = true;
    updateStatus.manual = false; // a download is not a check
    updateStatus.patch = undefined; // user-initiated, never the patch auto-flow
    lastBroadcastPercent = -1;
    broadcastStatus();
    resolveAndApply(channel, generation)
      .then((outcome) => {
        if (generation === checkGeneration) {
          updateStatus.checking = false;
          broadcastStatus();
        }
        if (outcome.verdict !== "upgrade") {
          throw new Error("no newer release available to download");
        }
        if (generation !== checkGeneration) {
          // superseded by a newer check/download: that flow owns the updater
          // now, and downloading here could ride a downgrade's temporarily
          // raised allowDowngrade
          log("info", "Download superseded by a newer check, not downloading");
          return;
        }
        // a user download never legitimately needs the downgrade override; a
        // superseded downgrade flow may still be mid-feed-apply with it raised
        autoUpdater.allowDowngrade = false;
        return autoUpdater.downloadUpdate();
      })
      .catch((unknownErr) => {
        const err = unknownToError(unknownErr);
        log("error", "Download failed", { error: err.message });
        updateStatus.error = err.message;
        installAfterDownloadFlag = false;
        if (generation === checkGeneration) {
          updateStatus.checking = false;
        }
        broadcastStatus();
      });
  });

  // Download the downgrade the user explicitly confirmed. Only honored while
  // an offer is outstanding. allowDowngrade is raised for just this flow and
  // dropped again once the library has accepted the feed.
  betterIpcMain.on("updater:download-downgrade", (_event, installAfterDownload: boolean) => {
    const target = pendingDowngrade;
    if (target == null) {
      log("warn", "Downgrade download requested but no downgrade offer is outstanding");
      return;
    }
    // One-shot consume: a second confirmation must not re-enter the flow.
    pendingDowngrade = null;
    log("info", "Downgrade download confirmed", { version: target.version });

    installAfterDownloadFlag = installAfterDownload;
    const generation = ++checkGeneration;
    updateStatus.checking = true;
    updateStatus.manual = false; // a download is not a check
    // Past confirmation the offer flag drops (keeping it would re-trigger the
    // offer UI on every progress push), but the flow stays labeled as a
    // downgrade via `downgrading` — presenting it as a regular update
    // download would misdescribe what is about to be installed.
    updateStatus.downgrade = undefined;
    updateStatus.downgrading = true;
    updateStatus.patch = undefined; // a downgrade is never a patch update
    lastBroadcastPercent = -1;
    broadcastStatus();

    // One-shot marker so the next launch's "Downgrade detected" warning is
    // suppressed for the version the user knowingly chose. Written before
    // allowDowngrade is raised so the raised window is only the feed apply.
    writePersistedValue("app", ["expectedDowngradeTo"], target.version)
      .catch((err: unknown) => {
        log("warn", "Failed to persist downgrade marker", {
          error: getErrorMessageOrDefault(err),
        });
      })
      .then(() => {
        autoUpdater.allowDowngrade = true;
        return applyResolvedFeed(target, generation);
      })
      .then(() => {
        autoUpdater.allowDowngrade = false;
        if (generation !== checkGeneration) {
          // a newer check superseded the confirmed downgrade mid-apply;
          // downloading now would fight that flow over the shared updater
          log("info", "Downgrade download superseded by a newer check, not downloading");
          return;
        }
        updateStatus.checking = false;
        broadcastStatus();
        return autoUpdater.downloadUpdate();
      })
      .catch((unknownErr) => {
        autoUpdater.allowDowngrade = false;
        const err = unknownToError(unknownErr);
        log("error", "Downgrade download failed", { error: err.message });
        updateStatus.error = err.message;
        updateStatus.downgrading = undefined;
        // Without the offer (consumed above) the failed target must not be
        // left advertised: the renderer would present the older version as a
        // regular available update whose Download can only ever fail.
        updateStatus.available = false;
        updateStatus.version = undefined;
        installAfterDownloadFlag = false;
        if (generation === checkGeneration) {
          updateStatus.checking = false;
        }
        broadcastStatus();
      });
  });

  // The user declined the outstanding downgrade offer: forget it. Only
  // another purposeful switch to stable raises it again.
  betterIpcMain.on("updater:decline-downgrade", () => {
    if (pendingDowngrade == null) {
      log("debug", "Downgrade decline with no offer outstanding");
      return;
    }
    log("info", "Downgrade offer declined", { version: pendingDowngrade.version });
    pendingDowngrade = null;
    updateStatus.available = false;
    updateStatus.downgrade = undefined;
    updateStatus.version = undefined;
    broadcastStatus();
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
