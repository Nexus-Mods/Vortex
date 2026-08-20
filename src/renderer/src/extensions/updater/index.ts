import type { UpdaterSnapshot, UpdaterState } from "@vortex/shared/ipc";

import type { IExtensionContext } from "../../types/IExtensionContext";
import { getApplication } from "../../util/application";
import settingsReducer from "./reducers";
import SettingsUpdate from "./SettingsUpdate";

// Notification surfaces. UPDATE is the single slot for "what the updater is
// doing with a version" (available/downloading/staged); the others are
// auxiliary and mutually independent.
const NOTIF_UPDATE = "vortex-update-available";
const NOTIF_OFFER = "vortex-downgrade-offer";
const NOTIF_ERROR = "vortex-update-error";
const NOTIF_TOAST = "vortex-up-to-date";
const NOTIF_CHECKING = "vortex-update-checking";
const NOTIF_UPDATED = "vortex-updated";

// The identity of a state for notification purposes: states with the same key
// upsert the standing notification in place (no re-toast); a key change is a
// user-meaningful transition and re-toasts. Progress percent is deliberately
// not part of the key.
function stateKey(state: UpdaterState): string {
  switch (state.type) {
    case "available":
    case "downgrade-offered":
      return `${state.type}:${state.version}`;
    case "downloading":
    case "staged":
      return `${state.type}:${state.kind}:${state.version}`;
    case "error":
      return `error:${state.message}`;
    default:
      return state.type;
  }
}

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

    const channelNow = () => context.api.store.getState().settings.update.channel;

    const dismiss = (id: string) => context.api.dismissNotification?.(id);

    const notificationExists = (id: string): boolean =>
      context.api
        .getState()
        .session.notifications.notifications.some((notification) => notification.id === id);

    // ---- dialogs -----------------------------------------------------------

    // What's New dialog with HTML release notes. Buttons act via their own
    // callbacks rather than label matching, so a renamed or translated label
    // can't silently break the action.
    const showUpdateDialog = async (version: string, releaseNotes?: string) => {
      const { state } = await window.api.updater.getStatus();
      const staged = state.type === "staged";
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
            label: staged ? "Restart Now" : "Download",
            default: true,
            action: () => {
              if (staged) {
                window.api.updater.restartAndInstall();
              } else {
                window.api.updater.downloadUpdate(channelNow(), false);
              }
            },
          },
        ],
        "new-update-changelog-dialog",
      );
    };

    // One-time notice on the first launch after an update; "View changes"
    // fetches the notes covering the versions the update went through.
    let shownUpdatedNotice = false;
    const showPostUpdateChanges = async () => {
      const version = getApplication().version;
      const notes = await window.api.updater.getUpdateChangelog(channelNow()).catch(() => null);
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

    // A downgrade offer only ever follows a purposeful switch to the stable
    // channel; it is presented as exactly what it is, never as an update.
    const showDowngradeOffer = (version: string) => {
      const currentVersion = getApplication().version;
      context.api.sendNotification({
        id: NOTIF_OFFER,
        type: "warning",
        message: `Vortex ${version} is a downgrade and older than your current version`,
        actions: [
          {
            title: "More",
            action: () => {
              void context.api.showDialog(
                "question",
                "Downgrade to stable?",
                {
                  text: `Switching to the Stable channel would install Vortex ${version}, which is older than the version you are running (${currentVersion}).

Downgrading can damage your application state. Alternatively, stay on your current version and you will be offered the next stable release once it is newer than ${currentVersion}.

If you downgrade, Vortex will download ${version} and update on restart.`,
                },
                [
                  {
                    label: "Stay on current version",
                    action: () => {
                      // declining forgets the offer (notification included)
                      // until the next purposeful switch to stable
                      dismiss(NOTIF_OFFER);
                      window.api.updater.declineDowngrade();
                    },
                  },
                  {
                    label: `Downgrade to ${version}`,
                    action: () => {
                      dismiss(NOTIF_OFFER);
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

    // ---- state → notifications --------------------------------------------

    // The updater is a state machine (see UpdaterState); this is the single
    // mapping from states to Vortex notifications. Everything the user sees
    // derives from the current state plus two rules:
    //   - background work is silent unless it changed something the user can
    //     see; button-pressed work is visible from press to settle
    //   - one update notification at a time (an actionable state supersedes
    //     the "was updated" notice)
    let prevState: UpdaterState | null = null;

    // the "Checking for updates..." feedback settles with the check
    const settleCheckToast = () => dismiss(NOTIF_CHECKING);

    const render = (snapshot: UpdaterSnapshot) => {
      const state = snapshot.state;
      const prev = prevState;
      prevState = state;

      // one-time "was updated" notice; any actionable state below supersedes it
      if (!shownUpdatedNotice && snapshot.justUpdatedFrom != null) {
        shownUpdatedNotice = true;
        context.api.sendNotification({
          id: NOTIF_UPDATED,
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

      // a settled manual check always answers, even when nothing changed
      const manualCheckSettled =
        prev?.type === "checking" && prev.manual && state.type !== "checking";

      const key = stateKey(state);
      const sameAsPrev = prev != null && stateKey(prev) === key;

      switch (state.type) {
        case "disabled":
        case "idle": {
          // nothing on offer: withdraw everything actionable
          settleCheckToast();
          dismiss(NOTIF_UPDATE);
          dismiss(NOTIF_OFFER);
          dismiss(NOTIF_ERROR);
          if (manualCheckSettled && state.type === "idle") {
            context.api.sendNotification({
              id: NOTIF_TOAST,
              type: "success",
              message: `Vortex ${getApplication().version} is up to date`,
              displayMS: 5000,
            });
          }
          return;
        }

        case "checking": {
          // manual checks are visible from the moment of the press;
          // background checks change nothing until they settle
          if (state.manual) {
            context.api.sendNotification({
              id: NOTIF_CHECKING,
              type: "activity",
              message: "Checking for updates...",
            });
          }
          return;
        }

        case "available": {
          settleCheckToast();
          dismiss(NOTIF_OFFER);
          dismiss(NOTIF_ERROR);
          dismiss(NOTIF_UPDATED);
          if (sameAsPrev && !manualCheckSettled && notificationExists(NOTIF_UPDATE)) {
            return; // unchanged and still on screen
          }
          dismiss(NOTIF_UPDATE); // re-create so the toast re-shows
          context.api.sendNotification({
            id: NOTIF_UPDATE,
            type: "info",
            message: `Vortex ${state.version} is available to download`,
            actions: [
              {
                title: "What's New",
                action: () => {
                  void showUpdateDialog(state.version, state.releaseNotes);
                },
              },
              {
                title: "Download",
                action: () => {
                  window.api.updater.downloadUpdate(channelNow(), false);
                  // keep the notification: it live-updates through
                  // downloading to staged
                },
              },
            ],
          });
          return;
        }

        case "downgrade-offered": {
          settleCheckToast();
          dismiss(NOTIF_UPDATE);
          dismiss(NOTIF_ERROR);
          dismiss(NOTIF_UPDATED);
          if (sameAsPrev && !manualCheckSettled && notificationExists(NOTIF_OFFER)) {
            return;
          }
          dismiss(NOTIF_OFFER);
          showDowngradeOffer(state.version);
          return;
        }

        case "downloading": {
          settleCheckToast();
          dismiss(NOTIF_OFFER);
          dismiss(NOTIF_ERROR);
          dismiss(NOTIF_UPDATED);
          // patches download silently — but a manual check that found one
          // still owes the user an answer
          if (state.kind === "patch") {
            if (manualCheckSettled) {
              context.api.sendNotification({
                id: NOTIF_TOAST,
                type: "info",
                message: `Vortex ${state.version} is downloading and will update on restart`,
                displayMS: 5000,
              });
            }
            return;
          }
          // the percent lives in the text: the theme's progress overlay is
          // too subtle to read, and the collapsed tray shows only the text
          const verb = state.kind === "downgrade" ? "Downgrading to" : "Downloading";
          context.api.sendNotification({
            id: NOTIF_UPDATE,
            type: "info",
            message:
              state.percent != null
                ? `${verb} Vortex ${state.version} (${state.percent}%)`
                : `${verb} Vortex ${state.version}`,
            progress: state.percent,
            // no buttons while the download runs — nothing sensible to click
          });
          return;
        }

        case "staged": {
          settleCheckToast();
          dismiss(NOTIF_OFFER);
          dismiss(NOTIF_ERROR);
          dismiss(NOTIF_UPDATED);
          if (sameAsPrev && !manualCheckSettled && notificationExists(NOTIF_UPDATE)) {
            return;
          }
          dismiss(NOTIF_UPDATE);
          if (state.kind === "update") {
            context.api.sendNotification({
              id: NOTIF_UPDATE,
              type: "info",
              message: `Vortex ${state.version} is ready to install`,
              actions: [
                {
                  title: "What's New",
                  action: () => {
                    void showUpdateDialog(state.version, state.releaseNotes);
                  },
                },
                {
                  // no dismiss: a packaged app quits here anyway, and if the
                  // install fails (or is skipped in dev) the button must stay
                  title: "Restart Now",
                  action: () => window.api.updater.restartAndInstall(),
                },
              ],
            });
          } else {
            // staged patches and confirmed downgrades install when Vortex
            // closes; the wording says so, Restart Now does it straight away
            context.api.sendNotification({
              id: NOTIF_UPDATE,
              type: "info",
              message: "Vortex will update on restart",
              actions: [
                {
                  title: "Restart Now",
                  action: () => window.api.updater.restartAndInstall(),
                },
              ],
            });
          }
          return;
        }

        case "error": {
          settleCheckToast();
          dismiss(NOTIF_OFFER);
          if (!sameAsPrev || !notificationExists(NOTIF_ERROR)) {
            dismiss(NOTIF_ERROR);
            const detail = state.message;
            context.api.sendNotification({
              id: NOTIF_ERROR,
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
          // keep a working Download next to the error when the update is
          // still known; otherwise the update notification is stale
          if (state.retry != null) {
            const retry = state.retry;
            if (sameAsPrev && notificationExists(NOTIF_UPDATE)) {
              return; // identical error re-broadcast: don't churn the retry
            }
            dismiss(NOTIF_UPDATE);
            context.api.sendNotification({
              id: NOTIF_UPDATE,
              type: "info",
              message: `Vortex ${retry.version} is available to download`,
              actions: [
                {
                  title: "What's New",
                  action: () => {
                    void showUpdateDialog(retry.version, retry.releaseNotes);
                  },
                },
                {
                  title: "Download",
                  action: () => {
                    window.api.updater.downloadUpdate(channelNow(), false);
                  },
                },
              ],
            });
          } else {
            dismiss(NOTIF_UPDATE);
          }
          return;
        }
      }
    };

    // ---- wiring -------------------------------------------------------------

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
        window.api.updater.setChannel(channelNow(), false);
      }
    }, 5000);

    // Vortex sessions stay open for days; without a periodic re-check a
    // long-running instance never hears about updates (including hotfix
    // patches, which auto-download) until the next launch.
    const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
    setInterval(() => {
      const channel = channelNow();
      if (channel !== "none") {
        window.api.updater.checkForUpdates(channel, false);
      }
    }, PERIODIC_CHECK_INTERVAL_MS);

    // Main pushes every state change; the one-time getStatus covers a check
    // that settled before this subscription existed (e.g. window reload).
    window.api.updater.onStatusChanged(render);
    window.api.updater
      .getStatus()
      .then(render)
      .catch(() => undefined);
  });

  return true;
}

export default init;
