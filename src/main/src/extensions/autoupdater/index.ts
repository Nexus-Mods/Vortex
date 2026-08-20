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
 *
 * The updater is modeled as an explicit state machine (UpdaterState in
 * @vortex/shared/ipc, patterned on VS Code's updater): exactly one state at a
 * time, every transition goes through setState, and the renderer renders
 * purely from the broadcast state. electron-updater's own events never drive
 * the state directly — we already resolved what "latest" means; the library
 * events only feed bookkeeping (downloaded-installer tracking, progress,
 * failures of an active download).
 */

import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import type { UpdateKind, UpdaterSnapshot, UpdaterState } from "@vortex/shared/ipc";
import { app, BrowserWindow } from "electron";
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

function toResolveChannel(channel: string): ResolveChannel {
  return channel === "beta" || channel === "next" ? channel : "stable";
}

function describeState(state: UpdaterState): string {
  switch (state.type) {
    case "checking":
      return state.manual ? "checking(manual)" : "checking";
    case "available":
      return `available ${state.version}`;
    case "downgrade-offered":
      return `downgrade-offered ${state.version}`;
    case "downloading":
      return `downloading ${state.version} (${state.kind}${state.percent != null ? ` ${state.percent}%` : ""})`;
    case "staged":
      return `staged ${state.version} (${state.kind})`;
    case "error":
      return `error${state.manual ? "(manual)" : ""}`;
    default:
      return state.type;
  }
}

/**
 * Set up the auto-updater in main process.
 * Handles checking for updates, downloading, and installing.
 */
export function setupAutoUpdater(installType: string): void {
  let cancellationToken: CancellationToken | undefined = undefined;
  const currentVersion = app.getVersion();
  // The release the last successful check resolved to — used only to prefer
  // the resolver's collected release notes over the (empty) generic-feed ones.
  // Downloads never trust it: updater:download re-resolves every time.
  let lastResolved: ResolvedRelease | null = null;
  // The downgrade offered after an explicit switch to stable, awaiting the
  // user's confirmation via updater:download-downgrade. Cleared by any check.
  let pendingDowngrade: ResolvedRelease | null = null;
  // Overlapping checks are possible (set-channel + manual check-now); only
  // the newest one may own the state and the shared electron-updater.
  let checkGeneration = 0;
  // Install-after-download requested (patch auto-flow never sets this).
  let installAfterDownloadFlag = false;
  // The version the downloaded installer on disk actually contains; a staged
  // state is only ever valid for this version.
  let downloadedVersion: string | null = null;

  // ---- state machine ------------------------------------------------------

  let current: UpdaterState = { type: "idle" };
  // One-time post-update notice; orthogonal to the state machine.
  let justUpdatedFrom: string | undefined;

  function snapshot(): UpdaterSnapshot {
    return { state: current, justUpdatedFrom };
  }

  function broadcast(): void {
    const payload = snapshot();
    for (const win of BrowserWindow.getAllWindows()) {
      betterIpcMain.send(win.webContents, "updater:status-changed", payload);
    }
  }

  function setState(next: UpdaterState): void {
    // progress ticks are debug noise; real transitions are info
    const progressTick = current.type === "downloading" && next.type === "downloading";
    log(progressTick ? "debug" : "info", "Updater state", {
      from: describeState(current),
      to: describeState(next),
    });
    current = next;
    broadcast();
  }

  // What kind of update a version represents for the running install.
  function kindFor(version: string): UpdateKind {
    return shouldAutoDownload(currentVersion, version, installType) ? "patch" : "update";
  }

  // ---- install ------------------------------------------------------------

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
    // The quit this triggers must not re-enter the install via the quit hook.
    app.removeListener("before-quit", installOnQuit);
    log("info", "Installing update", { attempt: installAttempts });
    try {
      autoUpdater.quitAndInstall();
    } catch (unknownErr) {
      handleInstallFailure(unknownToError(unknownErr));
    }
  }

  // Install on quit, visibly. The library's autoInstallOnAppQuit path runs
  // the installer silently (/S) — half a minute of disk churn with zero
  // feedback. Quitting with an update staged instead triggers the exact same
  // visible install as Restart Now (auto-update wizard + finish page).
  // One-shot: quit processing can re-fire before-quit.
  function installOnQuit(): void {
    app.removeListener("before-quit", installOnQuit);
    // only a settled staged update installs; anything else (a different
    // version advertised since, a download in flight) must not run a stale
    // installer on the way out
    if (current.type === "staged") {
      log("info", "Installing staged update on quit");
      attemptInstall();
    }
  }

  // (re-)arm the quit hook; called whenever a staged installer becomes current
  function armInstallOnQuit(): void {
    if (process.env.NODE_ENV !== "development" && app.isPackaged) {
      app.removeListener("before-quit", installOnQuit);
      app.on("before-quit", installOnQuit);
      log("info", "Visible install-on-quit armed");
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
      // an install is always user-visible; the installer is still staged
      setState({ type: "error", message: err.message, manual: true });
    }
  }

  // ---- IPC: status + changelog --------------------------------------------

  betterIpcMain.handle("updater:get-status", (): UpdaterSnapshot => snapshot());

  // Release notes for the update the app just went through — the renderer's
  // post-update "View changes". The resolver collects body_html of releases
  // above the given version, so resolving from the pre-update version yields
  // exactly the versions this update covered. The renderer supplies its
  // persisted channel: this handler is clickable before the first check has
  // run. Cached so repeat clicks don't share rate-limit fate with real checks.
  let changelogCache: { channel: string; notes: string | null } | null = null;
  betterIpcMain.handle(
    "updater:get-update-changelog",
    async (_event, channel: string): Promise<string | null> => {
      if (justUpdatedFrom == null) {
        return null;
      }
      const resolveChannel = toResolveChannel(channel);
      if (changelogCache != null && changelogCache.channel === resolveChannel) {
        return changelogCache.notes;
      }
      try {
        const resolvedRelease = await resolveUpdate(resolveChannel, justUpdatedFrom);
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
          justUpdatedFrom = previous;
          broadcast();
        }
      })
      .catch((err: unknown) => {
        log("debug", "Could not read previous app version", {
          error: getErrorMessageOrDefault(err),
        });
      });
  }

  log("info", "setupAutoUpdater", { installType, currentVersion });

  // ---- electron-updater configuration --------------------------------------

  // Downgrades are never taken from background checks; the resolver decides
  // what "latest" means and only strictly-newer versions are handed to
  // electron-updater at all.
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

  // ---- electron-updater events (bookkeeping, never primary state control) --

  autoUpdater.on("error", (err) => {
    const message = getErrorMessageOrDefault(err);
    // A cancelled download (channel switch mid-download) is the user's own
    // doing, not a failure to report. The superseding check owns the state.
    if (err instanceof Error && err.name === "CancellationError") {
      log("info", "Update download cancelled");
      if (current.type === "downloading") {
        setState({ type: "idle" });
      }
      return;
    }
    log("error", "Auto-updater error", { error: message });
    // A failed installer launch surfaces here; retry if it's a transient lock.
    if (installPending) {
      handleInstallFailure(unknownToError(err));
      return;
    }
    // A dying download is always user-relevant (a download only starts after
    // a successful check, so the network was just up). retry keeps a working
    // Download available alongside the error for regular updates.
    if (current.type === "downloading") {
      setState({
        type: "error",
        message,
        manual: true,
        retry:
          current.kind === "update"
            ? { version: current.version, releaseNotes: lastResolved?.notesHtml }
            : undefined,
      });
    }
    // Errors outside a download (e.g. a library-side check hiccup) are owned
    // by the promise chain that started the operation.
  });

  // The resolver already decided availability; these events only maintain the
  // downloaded-installer bookkeeping.
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    log("debug", "Library advertises version", { version: info.version });
  });
  autoUpdater.on("update-not-available", () => {
    log("debug", "Library advertises no update", { channel: "generic feed" });
  });

  // Download progress. Progress events fire many times per second on a
  // ~360 MB installer; broadcast only whole-percent changes.
  autoUpdater.on("download-progress", (progress: { percent: number }) => {
    if (current.type !== "downloading") {
      return;
    }
    const wholePercent = Math.floor(progress.percent);
    if (wholePercent !== current.percent) {
      setState({ ...current, percent: wholePercent });
    }
  });

  autoUpdater.on("update-downloaded", (updateInfo: UpdateInfo) => {
    log("info", "Update downloaded", { version: updateInfo.version });
    downloadedVersion = updateInfo.version;
    const kind: UpdateKind =
      current.type === "downloading" && current.version === updateInfo.version
        ? current.kind
        : kindFor(updateInfo.version);
    setState({
      type: "staged",
      version: updateInfo.version,
      kind,
      releaseNotes: lastResolved?.notesHtml,
    });

    // Install on quit stays OURS (visible), never the library's silent path:
    // autoInstallOnAppQuit remains false for the whole app lifetime.
    armInstallOnQuit();

    // If user requested immediate install, do it now (packaged builds only —
    // an unpackaged run with the dev updater must never install)
    if (installAfterDownloadFlag && process.env.NODE_ENV !== "development" && app.isPackaged) {
      log("info", "Auto-installing after download");
      installAfterDownloadFlag = false;
      attemptInstall();
    }
  });

  // ---- resolution ----------------------------------------------------------

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
        const currentValid = semver.valid(currentVersion);
        if (resolved != null && currentValid != null && semver.lt(resolved.version, currentValid)) {
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

  // ---- check ---------------------------------------------------------------

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

    const generation = ++checkGeneration;
    pendingDowngrade = null;
    // remembered so a failed BACKGROUND check can restore what the user could
    // already see instead of stranding "checking" or wiping a known update
    const before = current;
    setState({ type: "checking", manual });
    log("info", "Checking for updates", { channel, manual, currentVersion });

    resolveAndApply(channel, generation, allowDowngradeOffer)
      .then((outcome) => {
        if (generation !== checkGeneration) {
          return; // superseded by a newer check; let that one own the state
        }
        if (outcome.verdict === "none") {
          // A staged downgrade the user already confirmed survives checks
          // that (correctly) ignore the lower version — settling to idle
          // would orphan the downloaded installer and silently disarm its
          // install-on-quit.
          if (
            before.type === "staged" &&
            before.kind === "downgrade" &&
            downloadedVersion === before.version
          ) {
            setState(before);
          } else {
            setState({ type: "idle" });
          }
          return;
        }
        if (outcome.verdict === "downgrade-offer") {
          // Surface the offer; nothing downloads until the user confirms via
          // updater:download-downgrade.
          pendingDowngrade = outcome.release;
          setState({ type: "downgrade-offered", version: outcome.release.version });
          return;
        }
        const resolved = outcome.release;
        log("info", "Update check completed", { version: resolved.version });

        // An installer already on disk for exactly this version: it is staged,
        // not merely available (a channel flip and back must not forget it).
        if (downloadedVersion === resolved.version) {
          setState({
            type: "staged",
            version: resolved.version,
            kind: kindFor(resolved.version),
            releaseNotes: resolved.notesHtml,
          });
          armInstallOnQuit();
          return;
        }

        // Patch updates auto-download for regular installs; minor/major
        // updates wait for a user decision. A patch found by a MANUAL check
        // downloads visibly — the user's press set it in motion.
        if (kindFor(resolved.version) === "patch") {
          log("info", "Patch update detected, auto-downloading", {
            from: currentVersion,
            to: resolved.version,
          });
          setState({ type: "downloading", version: resolved.version, kind: "patch", manual });
          autoUpdater.downloadUpdate(cancellationToken).catch((err) => {
            // state transition owned by the "error" event handler
            log("warn", "Auto-download failed", { error: getErrorMessageOrDefault(err) });
          });
          return;
        }

        setState({
          type: "available",
          version: resolved.version,
          releaseNotes: resolved.notesHtml,
        });
      })
      .catch((err) => {
        if (err instanceof RateLimitError) {
          log("warn", "Update check rate-limited", { resetAt: err.resetAt.toISOString() });
        } else {
          log("warn", "Update check failed", { error: getErrorMessageOrDefault(err) });
        }
        if (generation !== checkGeneration) {
          return;
        }
        if (manual) {
          // a pressed button always gets an answer
          setState({
            type: "error",
            message:
              err instanceof RateLimitError
                ? "update check rate-limited by GitHub, try again later"
                : getErrorMessageOrDefault(err),
            manual: true,
          });
        } else {
          // offline is normal: restore whatever the user could already see
          setState(before.type === "checking" ? { type: "idle" } : before);
        }
      });
  };

  // ---- IPC: commands --------------------------------------------------------

  betterIpcMain.on("updater:set-channel", (_event, channel, manual) => {
    log("info", "Update channel changed", { channel, manual });

    if (cancellationToken) {
      cancellationToken.cancel();
    }
    lastResolved = null;

    if (channel === "none") {
      // Updates disabled: withdraw whatever was on offer, or a standing
      // notification keeps live buttons for an update the user opted out of.
      pendingDowngrade = null;
      setState({ type: "disabled" });
      return;
    }

    if (process.env.IGNORE_UPDATES !== "yes") {
      // A user-initiated switch to stable is the one flow allowed to offer a
      // downgrade (e.g. leaving the beta channel from a beta build).
      checkForUpdates(channel, manual, manual === true && channel === "stable");
    }
  });

  betterIpcMain.on("updater:check-for-updates", (_event, channel, manual) => {
    checkForUpdates(channel, manual);
  });

  betterIpcMain.on("updater:download", (_event, channel: string, installAfterDownload: boolean) => {
    log("info", "Download update requested", { channel, installAfterDownload });

    // Already downloaded: don't re-fetch the full installer. Re-issuing
    // downloadUpdate when the file is already present can resolve without
    // re-emitting "update-downloaded", which would strand the install request.
    // Install directly instead — but only when the installer on disk is the
    // version currently on offer; a channel switch can leave a stale download
    // for a different version.
    if (
      downloadedVersion != null &&
      (current.type === "staged" || current.type === "available") &&
      current.version === downloadedVersion
    ) {
      log("info", "Update already downloaded, skipping re-download", {
        version: downloadedVersion,
      });
      if (current.type !== "staged") {
        setState({
          type: "staged",
          version: downloadedVersion,
          kind: kindFor(downloadedVersion),
          releaseNotes: current.type === "available" ? current.releaseNotes : undefined,
        });
        armInstallOnQuit();
      }
      if (installAfterDownload) {
        attemptInstall();
      }
      return;
    }

    installAfterDownloadFlag = installAfterDownload;

    // Press feedback: the version being asked about is whatever is on offer.
    // The resolver may still supersede it below (it re-resolves every time).
    const requestedVersion =
      current.type === "available"
        ? current.version
        : current.type === "error" && current.retry != null
          ? current.retry.version
          : null;

    // Always re-resolve for the channel the renderer asked about: a cached
    // resolution could belong to a different channel, and re-applying the
    // feed guarantees the library-side check-before-download. The resolver's
    // ETag cache makes the repeat lookup cheap.
    const generation = ++checkGeneration;
    if (requestedVersion != null) {
      setState({ type: "downloading", version: requestedVersion, kind: "update", manual: true });
    } else {
      setState({ type: "checking", manual: true });
    }
    resolveAndApply(channel, generation)
      .then((outcome) => {
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
        if (current.type !== "downloading" || current.version !== outcome.release.version) {
          setState({
            type: "downloading",
            version: outcome.release.version,
            kind: "update",
            manual: true,
          });
        }
        return autoUpdater.downloadUpdate();
      })
      .catch((unknownErr) => {
        const err = unknownToError(unknownErr);
        log("error", "Download failed", { error: err.message });
        installAfterDownloadFlag = false;
        if (generation !== checkGeneration) {
          return;
        }
        setState({
          type: "error",
          message: err.message,
          manual: true,
          retry:
            requestedVersion != null
              ? { version: requestedVersion, releaseNotes: lastResolved?.notesHtml }
              : undefined,
        });
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
    // press feedback: the confirm is visible immediately
    setState({ type: "downloading", version: target.version, kind: "downgrade", manual: true });

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
        return autoUpdater.downloadUpdate();
      })
      .catch((unknownErr) => {
        autoUpdater.allowDowngrade = false;
        const err = unknownToError(unknownErr);
        log("error", "Downgrade download failed", { error: err.message });
        installAfterDownloadFlag = false;
        if (generation !== checkGeneration) {
          return;
        }
        // The offer was consumed, so there is nothing valid to retry — the
        // failed target must not be re-advertised as a regular update.
        setState({ type: "error", message: err.message, manual: true });
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
    setState({ type: "idle" });
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
