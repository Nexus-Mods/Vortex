/**
 * This extension is a host for automated tests against the current
 * setup to find problems with NMM2 in general, the setup for the current game,
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
 *      check function signature: (oldSettings, newSettings) => Promise
 *        oldSettings will be undefined on startup
 *   gamemode-activated: called on startup and whenever the active game changes.
 *      check function signature: (oldGameId, newGameId) => Promise
 *   profile-activated: called on startup and whenever the active profile changes.
 *      check function signature: (oldProfileId, newProfileId) => Promise
 */

import {CheckFunction, EventType, IExtensionContext} from '../../types/IExtensionContext';
import {log} from '../../util/log';
import {deleteOrNop, getSafe, setSafe} from '../../util/storeHelper';
import {setdefault} from '../../util/util';

import {ITestResult} from '../../types/ITestResult';

import ReportDashlet from './views/ReportDashlet';

import * as Promise from 'bluebird';

type CheckEntry = {id: string, check: CheckFunction};
let checks: { [type: string]: CheckEntry[] } = {};

let dashProps = {
  problems: {},
  onResolveProblem: (id: string) => {
    // whenever a "fix"-promise is finished we re-run that check to see if it's actually fixed
    let entry: CheckEntry;
    Object.keys(checks).forEach((type) => {
      if (entry === undefined) {
        entry = checks[type].find((iter) => iter.id === id);
      }
    });
    runCheck(entry);
  },
};

function runCheck(check: CheckEntry): Promise<void> {
  return check.check()
      .then((result: ITestResult) => {
        if (result !== undefined) {
          dashProps = setSafe(dashProps, ['problems', check.id], result);
        } else {
          dashProps = deleteOrNop(dashProps, ['problems', check.id]);
        }
      })
      .catch((err) => {
        log('warn', 'check failed to run', {
          id: check.id,
          event,
          err: err.message,
        });
      });
}

function runChecks(event: EventType): Promise<void> {
  return Promise.map(getSafe(checks, [event], []), (par: CheckEntry) => runCheck(par))
      .then(() => {
        log('debug', 'all checks completed',
            {event, problemCount: Object.keys(dashProps.problems).length});
      });
}

function init(context: IExtensionContext): boolean {
  context.registerTest =
      (id, eventType, check) => { setdefault(checks, eventType, []).push({ id, check }); };

  context.registerDashlet('Problems', 2, 10, ReportDashlet,
    (state) => Object.keys(dashProps.problems).length > 0, () => dashProps);

  context.once(() => {
    context.api.events.on('gamemode-activated', () => {
      runChecks('gamemode-activated');
    });

    context.api.events.on('profile-activated', () => {
      runChecks('profile-activated');
    });

    context.api.onStateChange(['settings'], () => {
      runChecks('settings-changed');
    });
  });

  return true;
}

export default init;
