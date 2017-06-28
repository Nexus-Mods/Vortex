import { addFeedbackFile, clearFeedbackFiles, removeFeedbackFile } from './actions/session';
import { sessionReducer } from './reducers/session';
import { IFeedbackFile } from './types/IFeedbackFile';

import FeedbackView from './views/FeedbackView';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import { selectors, tooltip, types, util } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import { Interpolate } from 'react-i18next';

function init(context: types.IExtensionContext) {

  context.registerMainPage('message', 'Feedback', FeedbackView, {
    hotkey: 'F',
    group: 'support',
  });

  context.registerReducer(['session', 'feedback'], sessionReducer);

  const checkNativeCrash = () => {
    const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');

    return fs.readdirAsync(nativeCrashesPath)
      .then((nativeCrashFiles) => {
        const nativeCrashFile = nativeCrashFiles.find((file) => path.extname(file) === '.dmp');
        return Promise.resolve(nativeCrashFile);
      });
  };

  const openFeedback = (evt) => {
    const gameMode = selectors.activeGameId(context.api.store.getState());

    const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');
    const nativeCrashFile = path.join(nativeCrashesPath, evt.currentTarget.value);

    fs.statAsync(nativeCrashFile)
      .then((stats) => {
        const feedbackFile: IFeedbackFile = {
          filename: path.basename(nativeCrashFile),
          filePath: nativeCrashFile,
          size: stats.size,
          type: 'tracelog',
          gameId: gameMode,
        };

        context.api.events.emit('add-feedback-file', feedbackFile);
      });

    context.api.events.emit('show-main-page', 'Feedback');
  };

  checkNativeCrash()
    .then((nativeCrashFile: string) => {
      if (nativeCrashFile !== undefined) {
        context.registerToDo('native-crash',
          () => ({ isCrashed: true }),
          (props: { isCrashed: boolean }) => props.isCrashed,
          () => {
            const t = context.api.translate;
            const link = (
              <tooltip.IconButton
                id='btn-report-native-crash'
                icon='bug'
                tooltip={t('Feedback')}
                onClick={openFeedback}
                value={nativeCrashFile}
              />
            );
            return (
              <span>
                <Interpolate
                  i18nKey='A native crash occurred. Click here to report the problem. {{link}}'
                  link={link}
                />
              </span>
            );
          });
      }
    });

  context.once(() => {

    context.api.events.on('add-feedback-file', (feedbackFile: IFeedbackFile) => {
      context.api.store.dispatch(addFeedbackFile(feedbackFile));

    });

    context.api.events.on('remove-feedback-file', (feedbackFileId: string) => {
      context.api.store.dispatch(removeFeedbackFile(feedbackFileId));

    });

    context.api.events.on('clear-feedback-files', (
      notificationId: string,
      feedbackFiles: { [fileId: string]: IFeedbackFile }) => {

      // TO DO - call nexus integration for the server call

      const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');
      let nativeCrashFile;

      if (feedbackFiles !== undefined) {
        nativeCrashFile = Object.keys(feedbackFiles).find((file) => path.extname(file) === '.dmp');
      }

      if (nativeCrashFile !== undefined) {
        fs.removeAsync(path.join(nativeCrashesPath, nativeCrashFile))
          .then(() => {
            context.api.store.dispatch(clearFeedbackFiles());
          })
          .catch((err) => {
            util.showError(context.api.store.dispatch,
              'An error occurred removing the dump file: ', err, false, notificationId);
          });
      }
    });
  });

  return true;
}

export default init;
