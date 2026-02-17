import type { IExtensionContext } from "../../renderer/types/IExtensionContext";
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

    // Show update details dialog with HTML release notes
    const showUpdateDialog = async (version: string, releaseNotes?: string) => {
      const status = await window.api.updater.getStatus();

      const result = await context.api.showDialog(
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
          },
        ],
        "new-update-changelog-dialog",
      );

      if (result.action === "Restart & Install") {
        window.api.updater.restartAndInstall();
      } else if (result.action === "Download" && !status.downloaded) {
        const channel = context.api.store.getState().settings.update.channel;
        window.api.updater.downloadUpdate(channel);
      }
    };

    // Query update status and show notification if update is available
    const checkUpdateStatus = async () => {
      try {
        const status = await window.api.updater.getStatus();
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
                action: () => {
                  if (status.downloaded) {
                    window.api.updater.restartAndInstall();
                  } else {
                    const channel =
                      context.api.store.getState().settings.update.channel;
                    window.api.updater.downloadUpdate(channel, true);
                  }
                },
              },
            ],
          });
        }
      } catch {
        // Silently ignore status check errors
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

    // Check update status once after update check completes (give it time)
    setTimeout(() => {
      void checkUpdateStatus();
    }, 15000);
  });

  return true;
}

export default init;
