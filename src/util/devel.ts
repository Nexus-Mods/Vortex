import { log } from './log';

import * as Promise from 'bluebird';

export function installDevelExtensions() {
  return new Promise((resolved, reject) => {
    if (process.env.NODE_ENV === 'development') {
      const installExtension = require('electron-devtools-installer');
      const { REACT_DEVELOPER_TOOLS, REACT_PERF } = require('electron-devtools-installer');

      try {
        installExtension.default(REACT_DEVELOPER_TOOLS)
          .then((name) => log('info', 'Added Extension', name))
          .catch((err) => log('error', 'An error occurred: ', { error: err }));

        installExtension.default(REACT_PERF)
          .then((name) => log('info', 'Added Extension', name))
          .catch((err) => log('error', 'An error occurred: ', { error: err }));
      } catch (e) {
        console.error(e);
      }
    }
    resolved();
  });
};
