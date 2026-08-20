import type { IExtensionContext } from "../../types/IExtensionContext";
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
    const handleUpdateStatus = (status: UpdateStatus) => {
      if (status.downgrade) {
        // downgrade offers get their own flow when the channel-switch UX
        // ships; never present one as a regular update
        return;
      }
      if (status.available && status.version) {
        context.api.sendNotification({
          id: "vortex-update-available",
          type: "info",
          message: `Vortex ${status.version} is available`,
          actions: [
            {
              title: "More",
              action: () => {
                void showUpdateDialog(status.version!, status.releaseNotes);
              },
            },
            {
              title: status.downloaded ? "Restart" : "Install",
              action: (dismiss) => {
                if (status.downloaded) {
                  window.api.updater.restartAndInstall();
                } else {
                  const channel = context.api.store.getState().settings.update.channel;
                  window.api.updater.downloadUpdate(channel, true);
                }
                dismiss();
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
