import { addFeedbackFile, clearFeedbackFiles, removeFeedbackFile } from './actions/session';
import { sessionReducer } from './reducers/session';
import { IFeedbackFile } from './types/IFeedbackFile';

import FeedbackView from './views/FeedbackView';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import { Icon, selectors, types, util } from 'nmm-api';
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
      .then((nativeCrashFile) => {
        if (nativeCrashFile[0] !== undefined) {
          return Promise.resolve(true);
        } else {
          return Promise.resolve(false);
        }
      });
  };

  const openFeedback = () => {
    const gameMode = selectors.activeGameId(context.api.store.getState());

    const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');
    const nativeCrashFile = path.join(nativeCrashesPath, 'operation_log.txt');

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
    .then((result) => {
      context.registerToDo('native-crash',
        () => ({ isCrashed: result }),
        (props: { isCrashed: boolean }) => props.isCrashed,
        () => {
          const t = context.api.translate;
          const link = (
            <a onClick={openFeedback}>
              <Icon name='sliders' />{t('Feedback')}</a>
          );
          return (
            <span>
              <Interpolate
                i18nKey='A native crash occurred. Open {{link}} to report the problem.'
                link={link}
              />
            </span>
          );
        });

    });

  context.once(() => {

    context.api.events.on('add-feedback-file', (feedbackFile: IFeedbackFile) => {
      context.api.store.dispatch(addFeedbackFile(feedbackFile));

    });

    context.api.events.on('remove-feedback-file', (feedbackFileId: string) => {
      context.api.store.dispatch(removeFeedbackFile(feedbackFileId));

    });

    context.api.events.on('clear-feedback-files', (notificationId: string) => {

      const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');
      const nativeCrashFile = path.join(nativeCrashesPath, 'operation_log.txt');

      fs.unlinkAsync(nativeCrashesPath)
        .then(() => {
          context.api.store.dispatch(clearFeedbackFiles());
          // TO DO - call nexus integration for the server call
          // - wrong clearFeedbackFiles here.
        })
        .catch((err) => {
          util.showError(context.api.store.dispatch,
           'An error occurred removing the log: ', err, false, notificationId);
        });
    });
  });

  return true;
}

export default init;
