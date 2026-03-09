// LEGACY FILE

/**
 * This extension is a host for automated tests against the current
 * setup to find problems with Vortex in general, the setup for the current game,
 * ...
 *
 * This extension is only responsible to run checks provided by other extensions
 * and to displays the results to the user, it does not contain its own checks.
 * It also allows users to suppress the check.
 *
 * New API:
 *   registerTest(id: string, eventType: string, check: function) - registers a test.
 *      _id_ a unique id for this test.
 *      _eventType_ specifies when the test runs and what parameters will be passed to
 *      the check function.
 *      _check_ is the check function. It should return (a promise of) null if the problem
 *      isn't present, otherwise a test result with - at the very least - a short description.
 *
 * Currently implemented event types:
 *   settings-changed: called on startup and whenever the user has changed settings. This will
 *      not necessarily be called on every single settings change, multiple changes may be
 *      aggregated.
 *   gamemode-activated: called on startup and whenever the active game changes.
 *   profile-did-change: called on startup and whenever the active profile changes.
 *   mod-installed: called whenever one or more mods were installed or removed
 *   mod-activated: called whenever one or more mods were activated or deactivated
 * Further event types can be triggered by extensions
 */

import type { DialogActions } from "../../actions/notifications";
import { showDialog } from "../../actions/notifications";
import { getErrorMessageOrDefault } from "@vortex/shared";
import type {
  CheckFunction,
  IExtensionApi,
  IExtensionContext,
} from "../../types/IExtensionContext";
import type { INotificationAction } from "../../types/INotification";
import type { ITestResult } from "../../types/ITestResult";
import { getApplication } from "../../util/application";
import { ProcessCanceled, UserCanceled } from "../../util/CustomErrors";
import { log } from "../../util/log";
import { activeGameId, activeProfile } from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { setdefault } from "../../util/util";

import PromiseBB from "bluebird";
import * as _ from "lodash";

interface ICheckEntry {
  id: string;
  check: CheckFunction;
  stack: () => string;
}
const checks: { [type: string]: ICheckEntry[] } = {};

const triggerDelays: { [type: string]: NodeJS.Timeout } = {};

const fixTriggered: { [id: string]: boolean } = {};

function applyFix(api: IExtensionApi, check: ICheckEntry, result: ITestResult) {
  if (fixTriggered[check.id]) {
    return PromiseBB.resolve();
  }
  fixTriggered[check.id] = true;
  return result
    .automaticFix()
    .then(() => runCheck(api, check))
    .catch((err) => {
      if (err instanceof UserCanceled || err instanceof ProcessCanceled) {
        return null;
      }
      if (err === undefined) {
        err = new Error("Invalid fix result");
      }
      err["attachLogOnReport"] = true;
      err["Fix"] = check.id;
      api.showErrorNotification("Failed to run automatic fix", err);
    })
    .finally(() => {
      fixTriggered[check.id] = false;
    });
}

function runCheck(api: IExtensionApi, check: ICheckEntry): PromiseBB<void> {
  let res: PromiseBB<ITestResult>;
  try {
    res = check.check();
  } catch (err) {
    log("warn", "check failed to run", {
      id: check.id,
      err: getErrorMessageOrDefault(err),
      stack: check.stack(),
    });
  }
  if (res === undefined || res.then === undefined) {
    res = PromiseBB.resolve(undefined);
  }
  return res
    .then((result) => {
      const id: string = `test-${check.id}`;
      if (result === undefined) {
        api.dismissNotification(id);
      } else {
        const dialogActions: DialogActions = [];
        if (result.automaticFix !== undefined) {
          dialogActions.push({
            label: "Fix",
            action: () => applyFix(api, check, result),
          });
        }

        const showMore = () =>
          api.store.dispatch(
            showDialog(
              "info",
              "Check failed",
              {
                bbcode: result.description.long,
                parameters: result.description.replace,
                options: {
                  bbcodeContext: result.description.context,
                  translated: result.description.localize === false,
                },
              },
              dialogActions,
            ),
          );

        if (result.severity === "fatal") {
          dialogActions.unshift({
            label: "Quit Vortex",
            action: () => getApplication().quit(0),
          });
          showMore();
        } else {
          dialogActions.unshift({ label: "Close" });
          const actions: INotificationAction[] = [];
          if (result.description.long !== undefined) {
            actions.push({
              title: "More",
              action: showMore,
            });
          }
          if (result.automaticFix !== undefined) {
            actions.push({
              title: "Fix",
              action: () => applyFix(api, check, result),
            });
          } else {
            actions.push({
              title: "Check again",
              action: () => {
                const preCheck =
                  result.onRecheck !== undefined
                    ? result.onRecheck()
                    : PromiseBB.resolve();
                return preCheck.then(() => runCheck(api, check));
              },
            });
          }
          api.sendNotification({
            id,
            type: result.severity,
            message: result.description.short,
            replace: result.description.replace,
            actions,
            noDismiss: true,
            allowSuppress: result.severity !== "error",
            localize: {
              title: result.description.localize,
              message: result.description.localize,
            },
          });
        }
      }
    })
    .catch((err) => {
      log("warn", "check failed to run", {
        id: check.id,
        err: err.message,
        stack: check.stack(),
      });
    });
}

const suppressedTests: { [testId: string]: number } = {};

function runChecks(api: IExtensionApi, event: string, delay?: number) {
  if (suppressedTests[event] ?? 0 > 0) {
    return;
  }

  if (triggerDelays[event] !== undefined) {
    clearTimeout(triggerDelays[event]);
  }

  triggerDelays[event] = setTimeout(() => {
    const eventChecks = getSafe(checks, [event], []);
    log("debug", "running checks", { event, count: eventChecks.length });
    PromiseBB.map(eventChecks, (par: ICheckEntry) => runCheck(api, par)).then(
      () => {
        log("debug", "all checks completed", { event });
      },
    );
  }, delay || 500);
}

function withSuppressedTests(tests: string[], cb: () => PromiseBB<void>) {
  tests.forEach((test) => {
    setdefault(suppressedTests, test, 0);
    suppressedTests[test] += 1;
  });

  return cb().finally(() => {
    tests.forEach((test) => {
      suppressedTests[test] -= 1;
    });
  });
}

function init(context: IExtensionContext): boolean {
  context.registerTest = (id, eventType, check) => {
    log("debug", "register test", { id, eventType });
    const stackErr = new Error();
    setdefault(checks, eventType, []).push({
      id,
      check,
      stack: () => stackErr.stack,
    });
  };

  context.registerAPI("withSuppressedTests", withSuppressedTests, {});

  context.once(() => {
    context.api.events.on(
      "trigger-test-run",
      (eventType: string, delay?: number) => {
        runChecks(context.api, eventType, delay);
      },
    );

    context.api.events.on("gamemode-activated", () => {
      runChecks(context.api, "gamemode-activated");
    });

    context.api.events.on("profile-did-change", () => {
      runChecks(context.api, "profile-did-change");
    });

    context.api.events.on("startup", () => {
      runChecks(context.api, "startup");
    });

    context.api.onStateChange(["settings"], () => {
      runChecks(context.api, "settings-changed");
    });

    context.api.onStateChange(["persistent", "mods"], (prevMods, newMods) => {
      const gameMode = activeGameId(context.api.store.getState());
      if (gameMode === undefined) {
        return;
      }
      if (
        !_.isEqual(
          Object.keys(prevMods[gameMode] || {}),
          Object.keys(newMods[gameMode] || {}),
        )
      ) {
        runChecks(context.api, "mod-installed", 5000);
      }
    });

    context.api.onStateChange(
      ["persistent", "profiles"],
      (prevProfiles, newProfiles) => {
        const currentProfile = activeProfile(context.api.store.getState());
        if (currentProfile === undefined) {
          // nop
          return;
        }
        if (
          prevProfiles[currentProfile.id].modState !==
          newProfiles[currentProfile.id].modState
        ) {
          runChecks(context.api, "mod-activated", 5000);
        }
      },
    );
  });

  return true;
}

export default init;
