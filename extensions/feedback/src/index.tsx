import { addFeedbackFile, clearFeedbackFiles, removeFeedbackFile } from './actions/session';
import { sessionReducer } from './reducers/session';
import { IFeedbackFile } from './types/IFeedbackFile';

import FeedbackView from './views/FeedbackView';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { selectors, tooltip, types, util } from 'vortex-api';

function checkNativeCrashFile() {
  const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');

  return fs.readdirAsync(nativeCrashesPath)
    .then((nativeCrashFiles) => {
      const nativeCrashFile = nativeCrashFiles.find((file) => path.extname(file) === '.dmp');
      return Promise.resolve(nativeCrashFile);
    });
}

function nativeCrashCheck(context: types.IExtensionContext): Promise<types.ITestResult> {
  return checkNativeCrashFile()
    .then((nativeCrashFile: string) => {
      if (nativeCrashFile !== undefined) {

        const nativeCrashesPath = path.join(remote.app.getPath('userData'),
          'temp', 'Vortex Crashes');
        nativeCrashFile = path.join(nativeCrashesPath, nativeCrashFile);

        return Promise.resolve({
          description: {
            short: 'A native crash occurred.',
            long: 'Click FIX to open the feedback page, then submit the crash file.',
          },
          severity: 'error',
          automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
            fs.statAsync(nativeCrashFile)
              .then((stats) => {
                const fileSize = stats.size / 1024 !== 0 ? Math.round(stats.size / 1024) : 1;
                const feedbackFile: IFeedbackFile = {
                  filename: path.basename(nativeCrashFile),
                  filePath: nativeCrashFile,
                  size: fileSize,
                  type: 'Dump',
                };

                context.api.store.dispatch(addFeedbackFile(feedbackFile));
              });

            context.api.events.emit('show-main-page', 'Feedback');
            fixResolve();
          }),
        });
      } else {
        return Promise.resolve(undefined);
      }
    });
}

function init(context: types.IExtensionContext) {
  context.registerMainPage('', 'Feedback', FeedbackView, {
    hotkey: 'F',
    group: 'hidden',
  });

  context.registerAction('global-icons', 100, 'feedback', {}, 'Send Feedback', () =>
    context.api.events.emit('show-main-page', 'Feedback'));

  context.registerReducer(['session', 'feedback'], sessionReducer);

  context.registerTest('native-crash', 'startup', () => nativeCrashCheck(context));

  context.once(() => {
    context.api.setStylesheet('feedback', path.join(__dirname, 'feedback.scss'));

    context.api.events.on('report-log-error',
      (logSessionPath: string) => {

        fs.statAsync(logSessionPath)
          .then((stats) => {
            const fileSize = stats.size / 1024 !== 0 ? Math.round(stats.size / 1024) : 1;
            const feedbackFile: IFeedbackFile = {
              filename: path.basename(logSessionPath),
              filePath: logSessionPath,
              size: fileSize,
              type: 'log',
            };
            context.api.store.dispatch(addFeedbackFile(feedbackFile));
          });
        context.api.events.emit('show-main-page', 'Feedback');
      });
  });

  return true;
}

export default init;
