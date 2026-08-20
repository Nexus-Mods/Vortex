import type { IExtensionContext } from "../../types/IExtensionContext";
import { getApplication } from "../../util/application";
import { log } from "../../util/log";
import settingsReducer from "./reducers";
import SettingsUpdate from "./SettingsUpdate";

function init(context: IExtensionContext): boolean {
  context.registerReducer(["settings", "update"], settingsReducer);
  context.registerSettings("Vortex", SettingsUpdate);

  context.once(() => {
    if (
      context.api.getState().app.installType !== "regular" &&
      process.env.NODE_ENV !== "development"
    ) {
      return;
    }

    let haveSetChannel = false;

    type UpdateStatus = Awaited<ReturnType<typeof window.api.updater.getStatus>>;

    // Show update details dialog with HTML release notes. Buttons act via
    // their own callbacks rather than label matching, so a renamed or
    // translated label can't silently break the action.
    const showUpdateDialog = async (version: string, releaseNotes?: string) => {
      const status = await window.api.updater.getStatus();

      await context.api.showDialog(
        "info",
        `What's New in ${version}`,
        {
          htmlText: releaseNotes
            ? `<div class="changelog-dialog-release">${releaseNotes}</div>`
            : "<p>A new version of Vortex is available.</p>",
        },
        [
          { label: "Close" },
          {
            // matches the notification's action button
            label: status.downloaded ? "Restart Now" : "Download",
            default: true,
            action: () => {
              if (status.downloaded) {
                window.api.updater.restartAndInstall();
              } else {
                const channel = context.api.store.getState().settings.update.channel;
                window.api.updater.downloadUpdate(channel);
              }
            },
          },
        ],
        "new-update-changelog-dialog",
      );
    };

    // React to a status pushed from main (or fetched for the initial sync):
    // upsert the update notification — same id, so repeated statuses update
    // it in place rather than stacking.
    // A downgrade offer only ever follows an explicit switch to the stable
    // channel; it is presented as exactly what it is, never as an update.
    const showDowngradeOffer = (status: UpdateStatus) => {
      const currentVersion = getApplication().version;
      context.api.sendNotification({
        id: "vortex-downgrade-offer",
        type: "warning",
        message: `Vortex ${status.version} is a downgrade and older than your current version`,
        actions: [
          {
            title: "More",
            action: () => {
              void context.api.showDialog(
                "question",
                "Downgrade to stable?",
                {
                  text: `Switching to the Stable channel would install Vortex ${status.version}, which is older than the version you are running (${currentVersion}).

Downgrading can damage your application state. Alternatively, stay on your current version and you will be offered the next stable release once it is newer than ${currentVersion}.

If you downgrade, Vortex will download ${status.version} and update on restart.`,
                },
                [
                  {
                    label: "Stay on current version",
                    action: () => {
                      // declining forgets the offer (notification included)
                      // until the next check raises it again
                      context.api.dismissNotification?.("vortex-downgrade-offer");
                      window.api.updater.declineDowngrade();
                    },
                  },
                  {
                    label: `Downgrade to ${status.version}`,
                    action: () => {
                      context.api.dismissNotification?.("vortex-downgrade-offer");
                      // download without forcing a restart: once staged it
                      // installs on quit, or via the notification's Restart Now
                      window.api.updater.downloadDowngrade(false);
                    },
                  },
                ],
                "downgrade-offer-dialog",
              );
            },
          },
        ],
      });
    };

    // The toast only shows when a notification is created — same-id updates
    // keep their createdTime and stay collapsed in the tray. Dismiss and
    // re-send on user-meaningful transitions (new version, download finished)
    // so the toast re-appears; skip pushes that change nothing the user sees
    // (e.g. download progress) — unless the notification was dismissed in the
    // meantime, in which case a fresh check resurrects it.
    let lastShown: {
      version?: string;
      downloaded: boolean;
      downgrade: boolean;
      downgrading: boolean;
      progress?: number;
    } | null = null;
    let lastErrorShown: string | null = null;

    const notificationExists = (id: string): boolean =>
      context.api
        .getState()
        .session.notifications.notifications.some((notification) => notification.id === id);

    let prevStatus: UpdateStatus | null = null;

    // One-time notice on the first launch after an update; "View changes"
    // fetches the notes covering the versions the update went through.
    let shownUpdatedNotice = false;
    const showPostUpdateChanges = async () => {
      const version = getApplication().version;
      const channel = context.api.store.getState().settings.update.channel;
      const notes = await window.api.updater.getUpdateChangelog(channel).catch(() => null);
      await context.api.showDialog(
        "info",
        `What's New in ${version}`,
        {
          htmlText: notes
            ? `<div class="changelog-dialog-release">${notes}</div>`
            : "<p>No release notes are available for this update.</p>",
        },
        [{ label: "Close" }],
        "new-update-changelog-dialog",
      );
    };

    const handleUpdateStatus = (status: UpdateStatus) => {
      if (!shownUpdatedNotice && status.justUpdatedFrom != null) {
        shownUpdatedNotice = true;
        context.api.sendNotification({
          id: "vortex-updated",
          type: "success",
          message: `Vortex was updated to ${getApplication().version}`,
          actions: [
            {
              title: "View changes",
              action: () => {
                void showPostUpdateChanges();
              },
            },
          ],
        });
      }

      // A user-initiated check deserves visible feedback either way: re-toast
      // the update notification even if nothing changed, or say "up to date".
      const manualCheckCompleted =
        prevStatus?.checking === true && prevStatus.manual === true && status.checking !== true;
      prevStatus = status;

      // Mid-check pushes are transient: every check clears the downgrade and
      // patch labels before re-resolving, so acting on a checking status
      // renders the previous offer stripped of its identity (a patch would
      // briefly show the loud Download notification). Only settled statuses
      // drive notifications.
      if (status.checking === true) {
        return;
      }

      // Failures were invisible outside the log: a download that dies (bad
      // signature, network) or a failed check now says so. Shown once per
      // distinct error, withdrawn when a later attempt clears it.
      if (status.error != null) {
        if (status.error !== lastErrorShown) {
          lastErrorShown = status.error;
          const detail = status.error;
          context.api.sendNotification({
            id: "vortex-update-error",
            type: "error",
            message: "Vortex update failed",
            actions: [
              {
                title: "More",
                action: () => {
                  void context.api.showDialog(
                    "error",
                    "Vortex update failed",
                    { text: detail },
                    [{ label: "Close" }],
                    "update-error-dialog",
                  );
                },
              },
            ],
          });
        }
      } else if (lastErrorShown != null) {
        lastErrorShown = null;
        context.api.dismissNotification?.("vortex-update-error");
      }

      // The resolver settled on "nothing available": withdraw any standing
      // notification (a retracted downgrade offer, a failed downgrade, a
      // release pulled from the feed) so dead buttons don't linger.
      if (!status.available) {
        context.api.dismissNotification?.("vortex-update-available");
        context.api.dismissNotification?.("vortex-downgrade-offer");
        lastShown = null;
        if (manualCheckCompleted) {
          // a failed check must not masquerade as "up to date"
          if (status.error == null) {
            context.api.sendNotification({
              id: "vortex-up-to-date",
              type: "success",
              message: `Vortex ${getApplication().version} is up to date`,
              displayMS: 5000,
            });
          }
        }
        return;
      }

      if (manualCheckCompleted) {
        lastShown = null; // bypass the dedupe so the toast re-shows
        // A patch mid-download shows no standing notification, but a manual
        // check still owes the user an answer.
        if (status.patch && !status.downloaded && status.version) {
          context.api.sendNotification({
            id: "vortex-up-to-date",
            type: "info",
            message: `Vortex ${status.version} is downloading and will update on restart`,
            displayMS: 5000,
          });
          return;
        }
      }

      const shown = {
        version: status.version,
        downloaded: status.downloaded,
        downgrade: status.downgrade === true,
        downgrading: status.downgrading === true,
        // whole percent while a download is in flight — so the notification
        // can show a live bar (a frozen bar is also the only honest signal
        // for a stalled download)
        progress:
          !status.downloaded && typeof status.downloadProgress === "number"
            ? Math.floor(status.downloadProgress)
            : undefined,
      };
      const sameOffer =
        lastShown != null &&
        lastShown.version === shown.version &&
        lastShown.downloaded === shown.downloaded &&
        lastShown.downgrade === shown.downgrade &&
        lastShown.downgrading === shown.downgrading;
      if (
        sameOffer &&
        lastShown!.progress === shown.progress &&
        notificationExists(shown.downgrade ? "vortex-downgrade-offer" : "vortex-update-available")
      ) {
        return;
      }
      // Progress ticks update the notification in place; dismiss-and-resend
      // (which re-toasts) is reserved for user-meaningful transitions.
      const progressOnly = sameOffer && lastShown!.progress !== shown.progress;

      // A confirmed downgrade downloading is exactly that — describing it as
      // an available update misstates what is happening. Once downloaded it
      // reads like a staged patch below: it installs on quit, Restart Now
      // does it straight away.
      if (status.downgrading && !status.downloaded) {
        if (status.version) {
          lastShown = shown;
          if (!progressOnly) {
            context.api.dismissNotification?.("vortex-update-available");
            context.api.dismissNotification?.("vortex-updated");
          }
          context.api.sendNotification({
            id: "vortex-update-available",
            type: "info",
            // the percent lives in the text: the theme's progress overlay is
            // too subtle to read, and the collapsed tray shows only the text
            message:
              shown.progress != null
                ? `Downgrading to Vortex ${status.version} (${shown.progress}%)`
                : `Downgrading to Vortex ${status.version}`,
            progress: shown.progress,
          });
        }
        return;
      }

      if (status.downgrade) {
        if (status.version) {
          lastShown = shown;
          context.api.dismissNotification?.("vortex-downgrade-offer");
          context.api.dismissNotification?.("vortex-updated");
          showDowngradeOffer(status);
        } else {
          log("warn", "downgrade status without a version", status);
        }
        return;
      }
      if (status.available && status.version) {
        // Patch updates download themselves: stay quiet until the download
        // is staged, then say what actually happens next (install on quit).
        if (status.patch && !status.downloaded) {
          return;
        }
        lastShown = shown;
        if (!progressOnly) {
          context.api.dismissNotification?.("vortex-update-available");
          // an actionable update supersedes the "was updated" notice — two
          // update notifications at once reads as a glitch
          context.api.dismissNotification?.("vortex-updated");
        }
        // Staged patches and confirmed downgrades install when Vortex closes;
        // the wording says so, and Restart Now does it straight away.
        if (status.patch || status.downgrading) {
          context.api.sendNotification({
            id: "vortex-update-available",
            type: "info",
            message: "Vortex will update on restart",
            actions: [
              {
                title: "Restart Now",
                // no dismiss: a packaged app quits here anyway, and if the
                // install fails (or is skipped in dev) the button must stay
                action: () => window.api.updater.restartAndInstall(),
              },
            ],
          });
          return;
        }
        context.api.sendNotification({
          id: "vortex-update-available",
          type: "info",
          message: status.downloaded
            ? `Vortex ${status.version} is ready to install`
            : shown.progress != null
              ? `Downloading Vortex ${status.version} (${shown.progress}%)`
              : `Vortex ${status.version} is available to download`,
          progress: shown.progress,
          // no buttons at all while the download is running — there is
          // nothing sensible to click until it settles
          actions:
            shown.progress != null
              ? undefined
              : [
                  {
                    title: "What's New",
                    action: () => {
                      void showUpdateDialog(status.version!, status.releaseNotes);
                    },
                  },
                  {
                    // Not downloaded yet (minor/major updates wait for the
                    // user): the button downloads, and the pushed "downloaded"
                    // status then flips this same notification to Restart Now.
                    title: status.downloaded ? "Restart Now" : "Download",
                    action: () => {
                      if (status.downloaded) {
                        // no dismiss: a packaged app quits here anyway, and if
                        // the install fails (or is skipped in dev) the button
                        // must stay
                        window.api.updater.restartAndInstall();
                      } else {
                        const channel = context.api.store.getState().settings.update.channel;
                        window.api.updater.downloadUpdate(channel, false);
                        // keep the notification: it live-updates to show the
                        // Restart Now action once the download completes
                      }
                    },
                  },
                ],
        });
      }
    };

    // check for update when the user changes the update channel
    context.api.onStateChange(
      ["settings", "update", "channel"],
      (_oldChannel: string, newChannel: string) => {
        window.api.updater.setChannel(newChannel, true);
        haveSetChannel = true;
      },
    );

    // unless the user changes the update channel before,
    // check for update in 5 seconds
    setTimeout(() => {
      if (!haveSetChannel) {
        const channel = context.api.store.getState().settings.update.channel;
        window.api.updater.setChannel(channel, false);
      }
    }, 5000);

    // Vortex sessions stay open for days; without a periodic re-check a
    // long-running instance never hears about updates (including hotfix
    // patches, which auto-download) until the next launch.
    const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
    setInterval(() => {
      const channel = context.api.store.getState().settings.update.channel;
      if (channel !== "none") {
        window.api.updater.checkForUpdates(channel, false);
      }
    }, PERIODIC_CHECK_INTERVAL_MS);

    // Main pushes every status change; the one-time getStatus covers a check
    // that finished before this subscription existed (e.g. window reload).
    window.api.updater.onStatusChanged(handleUpdateStatus);
    window.api.updater
      .getStatus()
      .then(handleUpdateStatus)
      .catch(() => undefined);
  });

  return true;
}

export default init;
