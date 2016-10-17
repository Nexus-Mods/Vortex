import { app as appIn, dialog as dialogIn, remote } from 'electron';

import { log } from './log';

export interface ITermination {
  message: string;
  details?: string;
}

/**
 * display an error message and quit the application
 * on confirmation.
 * Use this whenever the application state is unknown and thus
 * continuing could lead to data loss
 * 
 * @export
 * @param {ITermination} error
 */
export function terminate(error: ITermination) {
  const app = appIn || remote.app;
  const dialog = dialogIn || remote.dialog;

  log('error', 'unrecoverable error', error);

  dialog.showMessageBox(null, {
    type: 'error',
    buttons: [ 'Quit' ],
    title: 'An unrecoverable error occured',
    message: error.message,
    detail: error.details,
    noLink: true,
  });

  app.exit(1);
}
