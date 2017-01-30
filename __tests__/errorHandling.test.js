import { terminate } from '../src/util/errorHandling';

import { app, dialog } from 'electron';
import * as logger from 'winston';

jest.mock('../src/util/log');

describe('terminate', () => {
  logger.level = 'crit';

  it('terminate opens an error message box', () => {
    dialog.showMessageBox.mockClear();
    terminate('test');
    expect(dialog.showMessageBox.mock.calls.length).toEqual(1);
    expect(dialog.showMessageBox.mock.calls[0][1].type).toEqual('error');
  });

  it('terminate exits the application with a status code', () => {
    app.exit.mockClear();
    terminate('test');
    expect(app.exit.mock.calls.length).toEqual(1);
    expect(app.exit.mock.calls[0][0]).toEqual(1);
  });
});
