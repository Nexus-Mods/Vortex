import { app as appIn, dialog as dialogIn, remote } from 'electron';

import { log } from './log';

let app = appIn || remote.app;
let dialog = dialogIn || remote.dialog;

export interface ITermination {
  message: string;
  details?: string;
}

export function terminate(error: ITermination)
{
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
