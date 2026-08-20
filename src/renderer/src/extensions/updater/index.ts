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
            label: status.downloaded ? "Restart & Install" : "Download",
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
        message: `Stable version ${status.version} is older than your current version`,
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

If you downgrade, Vortex will restart and install ${status.version} as soon as the download completes.`,
                },
                [
                  { label: "Stay on current version" },
                  {
                    label: `Downgrade to ${status.version}`,
                    action: () => {
                      context.api.dismissNotification?.("vortex-downgrade-offer");
                      window.api.updater.downloadDowngrade(true);
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
    let lastShown: { version?: string; downloaded: boolean; downgrade: boolean } | null = null;

    const notificationExists = (id: string): boolean =>
      context.api
        .getState()
        .session.notifications.notifications.some((notification) => notification.id === id);

    let prevStatus: UpdateStatus | null = null;

    const handleUpdateStatus = (status: UpdateStatus) => {
      // A user-initiated check deserves visible feedback either way: re-toast
      // the update notification even if nothing changed, or say "up to date".
      const manualCheckCompleted =
        prevStatus?.checking === true && prevStatus.manual === true && status.checking !== true;
      prevStatus = status;
      if (manualCheckCompleted) {
        if (status.available) {
          lastShown = null; // bypass the dedupe so the toast re-shows
        } else {
          context.api.sendNotification({
            id: "vortex-up-to-date",
            type: "success",
            message: `Vortex ${getApplication().version} is up to date`,
            displayMS: 5000,
          });
          return;
        }
      }

      const shown = {
        version: status.version,
        downloaded: status.downloaded,
        downgrade: status.downgrade === true,
      };
      if (
        lastShown != null &&
        lastShown.version === shown.version &&
        lastShown.downloaded === shown.downloaded &&
        lastShown.downgrade === shown.downgrade &&
        notificationExists(shown.downgrade ? "vortex-downgrade-offer" : "vortex-update-available")
      ) {
        return;
      }

      if (status.downgrade) {
        if (status.version) {
          lastShown = shown;
          context.api.dismissNotification?.("vortex-downgrade-offer");
          showDowngradeOffer(status);
        } else {
          log("warn", "downgrade status without a version", status);
        }
        return;
      }
      if (status.available && status.version) {
        lastShown = shown;
        context.api.dismissNotification?.("vortex-update-available");
        context.api.sendNotification({
          id: "vortex-update-available",
          type: "info",
          // once staged, the update installs on quit — say so rather than
          // surprising the user when they close Vortex
          message: status.downloaded
            ? `Vortex ${status.version} will install when you close Vortex`
            : `Vortex ${status.version} is available`,
          actions: [
            {
              title: "More",
              action: () => {
                void showUpdateDialog(status.version!, status.releaseNotes);
              },
            },
            {
              // Not downloaded yet (minor/major updates wait for the user):
              // the button downloads, and the pushed "downloaded" status then
              // flips this same notification to Restart & Install. Patch
              // updates arrive already downloaded, so they start there.
              title: status.downloaded ? "Restart & Install" : "Download",
              action: () => {
                if (status.downloaded) {
                  // no dismiss: a packaged app quits here anyway, and if the
                  // install fails (or is skipped in dev) the button must stay
                  window.api.updater.restartAndInstall();
                } else {
                  const channel = context.api.store.getState().settings.update.channel;
                  window.api.updater.downloadUpdate(channel, false);
                  // keep the notification: it live-updates to show the
                  // Restart & Install action once the download completes
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
