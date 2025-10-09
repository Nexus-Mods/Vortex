import { removeQuarantineRecursively } from '../../src/util/archive';
import * as child_process from 'child_process';

jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    return {
      on: (ev: string, cb: Function) => {
        if (ev === 'close') setImmediate(() => cb(0));
      }
    } as any;
  }),
}));

describe('removeQuarantineRecursively (macOS)', () => {
  const platform = process.platform;
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });
  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: platform });
  });

  test('invokes xattr to remove quarantine', async () => {
    await expect(removeQuarantineRecursively('/some/path')).resolves.toBeUndefined();
    expect((child_process.spawn as jest.Mock)).toHaveBeenCalled();
  });
});