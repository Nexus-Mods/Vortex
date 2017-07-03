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

function checkNativeCrash() {
  const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');

  return fs.readdirAsync(nativeCrashesPath)
    .then((nativeCrashFiles) => {
      const nativeCrashFile = nativeCrashFiles.find((file) => path.extname(file) === '.dmp');
      return Promise.resolve(nativeCrashFile);
    });
}

function init(context: types.IExtensionContext) {

  context.registerMainPage('message', 'Feedback', FeedbackView, {
    hotkey: 'F',
    group: 'support',
  });

  context.registerReducer(['session', 'feedback'], sessionReducer);

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
          type: 'dump',
          gameId: gameMode,
        };

        context.api.store.dispatch(addFeedbackFile(feedbackFile));
      });

    context.api.events.emit('show-main-page', 'Feedback');
  };

  context.once(() => {

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
  });

  return true;
}

export default init;
