import { terminate } from '../src/util/errorHandling';
import { UserCanceled } from '../src/util/CustomErrors';

import { app, dialog } from 'electron';
import * as logger from 'winston';

jest.mock('../src/util/log');

describe('terminate', () => {
  logger.level = 'crit';

  it('terminate opens an error message box', () => {
    dialog.showMessageBoxSync.mockClear();
    expect(() => terminate('test')).toThrowError(new UserCanceled());
    expect(dialog.showMessageBoxSync.mock.calls.length).toEqual(1);
    expect(dialog.showMessageBoxSync.mock.calls[0][1].type).toEqual('error');
  });

  it('terminate exits the application with a status code', () => {
    app.exit.mockClear();
    expect(() => terminate('test')).toThrowError(new UserCanceled());
    expect(app.exit.mock.calls.length).toEqual(1);
    expect(app.exit.mock.calls[0][0]).toEqual(1);
  });
});
